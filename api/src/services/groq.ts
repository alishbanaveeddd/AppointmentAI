/**
 * M6 — Groq-backed assistant adapter (backend-only, per D-005).
 *
 * Implements the existing `AssistantAdapter` contract from `./chat.ts`. All
 * provider calls happen on the server only. The provider API key is read from
 * validated server-side environment config and is never logged or returned.
 *
 * Flow (docs/AI_WORKFLOW.md steps 2-6 + D-010): build bounded context → POST
 * to Groq in JSON mode with a finite timeout → parse `choices[0].message.content`
 * → validate against the Zod schema → resolve relative dates in Asia/Karachi →
 * recompute `missingFields` server-side → map to `AssistantAdapterResult`.
 *
 * Any provider/parse/validation failure returns a controlled fallback
 * (`state: needs_fallback`); expected failures never throw to the caller and
 * never leak provider exceptions, keys, or request bodies.
 *
 * Per docs/ARCHITECTURE.md ("AI service: ... No database writes") — no persistence.
 */
import type {
  AssistantAdapter,
  AssistantAdapterResult,
  AssistantBookingState,
  BookingState,
  MessageSummary,
} from './chat';
import {
  AiExtractionSchema,
  type AiExtraction,
  type BookingField,
  type ExtractOutcome,
} from '../schemas/ai';
import { BOOKING_TIMEZONE } from '../config/booking';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_TIMEOUT_MS = 8000;

// Bounded context policy (docs/AI_WORKFLOW.md "Bounded context").
const MAX_HISTORY_MESSAGES = 6;
const MAX_TOTAL_INPUT_CHARS = 6000;
const MAX_MESSAGE_CHARS = 1500;

const MISSING_BOOKING_FIELDS = ['service', 'requested_date', 'requested_time'] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const relativeDayRegex =
  /^(?:(today|tomorrow|yesterday)|(?:\+?(\d+)\s*days?)|in\s+(\d+)\s*days?)$/i;

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const weekdayRegex =
  /^(?:(this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)$/i;

/** Minimal provider-agnostic fetch surface (avoids coupling to @types/node fetch). */
export interface ProviderResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface ProviderRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export type FetchFn = (input: string, init: ProviderRequestInit) => Promise<ProviderResponse>;

export interface GroqAdapterDeps {
  /** Provider API key (validated server-side). Never logged. */
  readonly apiKey: string;
  readonly model?: string;
  /** Injectable fetch for deterministic tests. */
  readonly fetch?: FetchFn;
  readonly timeoutMs?: number;
  readonly now?: () => Date;
  readonly logger?: (entry: {
    provider: 'groq';
    model: string;
    latencyMs: number;
    outcome: ExtractOutcome;
    status?: number;
  }) => void;
}

/** Internal error carrying only a safe outcome code + optional HTTP status. */
class GroqError extends Error {
  constructor(
    public readonly outcome: ExtractOutcome,
    public readonly status?: number,
  ) {
    super(`Groq adapter failure: ${outcome}${status !== undefined ? ` (status ${status})` : ''}`);
    this.name = 'GroqError';
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function formatDateInTz(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Resolves `requested_date` to YYYY-MM-DD in the business timezone. Relative
 * tokens (today/tomorrow/yesterday/in N days, and weekdays like Monday/next Tuesday)
 * resolve against the injected clock.
 */
function resolveRequestedDate(raw: string | null | undefined, now: Date): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  if (DATE_REGEX.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d) {
      return trimmed;
    }
    return null;
  }

  const today = formatDateInTz(now, BOOKING_TIMEZONE);
  const base = new Date(today + 'T00:00:00Z');

  // 1. Check relative day tokens (today, tomorrow, in N days)
  const relMatch = relativeDayRegex.exec(trimmed.toLowerCase());
  if (relMatch) {
    let delta = 0;
    if (relMatch[1] === 'today') {
      delta = 0;
    } else if (relMatch[1] === 'tomorrow') {
      delta = 1;
    } else if (relMatch[1] === 'yesterday') {
      delta = -1;
    } else {
      const n = relMatch[2] !== undefined ? Number(relMatch[2]) : Number(relMatch[3]);
      if (!Number.isFinite(n) || n < 0) return null;
      delta = n;
    }
    const target = new Date(base.getTime() + delta * 86_400_000);
    return formatDateInTz(target, BOOKING_TIMEZONE);
  }

  // 2. Check weekday names (Monday, next Tuesday, etc.)
  const weekMatch = weekdayRegex.exec(trimmed.toLowerCase());
  if (weekMatch) {
    const targetDayIdx = WEEKDAY_MAP[weekMatch[2].toLowerCase()];
    if (targetDayIdx !== undefined) {
      const currentWeekdayName = new Intl.DateTimeFormat('en-US', {
        timeZone: BOOKING_TIMEZONE,
        weekday: 'short',
      })
        .format(now)
        .toLowerCase();
      const currentDayIdx = WEEKDAY_MAP[currentWeekdayName] ?? now.getUTCDay();

      let delta = (targetDayIdx - currentDayIdx + 7) % 7;
      if (delta === 0 || weekMatch[1]?.toLowerCase() === 'next') {
        delta += 7;
      }
      const target = new Date(base.getTime() + delta * 86_400_000);
      return formatDateInTz(target, BOOKING_TIMEZONE);
    }
  }

  return null;
}

function resolveRequestedTime(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return TIME_REGEX.test(trimmed) ? trimmed : null;
}

/** Recompute missing fields from validated values (never trust the model's list). */
function recomputeMissingFields(
  service: string | null,
  requested_date: string | null,
  requested_time: string | null,
): BookingField[] {
  const missing: BookingField[] = [];
  if (!service) missing.push('service');
  if (!requested_date) missing.push('requested_date');
  if (!requested_time) missing.push('requested_time');
  return missing;
}

/** Recovers service name from prior conversation turns if the user mentioned it previously. */
function recoverServiceFromHistory(history?: MessageSummary[]): string | null {
  if (!history || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const text = history[i].content;
    if (/dental/i.test(text)) return 'Dental Consultation';
    if (/consultation/i.test(text)) return 'General Consultation';
    if (/checkup/i.test(text)) return 'Health Checkup';
    if (/meeting/i.test(text)) return 'General Consultation';
    if (/strategy/i.test(text)) return 'Strategy Session';
  }
  return null;
}

/** Parses the raw model string and validates it against the Zod extraction schema. */
function parseExtraction(raw: string, now: Date, history?: MessageSummary[]): AiExtraction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroqError('malformed_json');
  }
  const result = AiExtractionSchema.safeParse(parsed);
  if (!result.success) {
    throw new GroqError('validation_failed');
  }
  return normalizeExtraction(result.data, now, history);
}

/** Normalizes a schema-valid extraction (resolves dates, recomputes missingFields). */
function normalizeExtraction(
  extraction: AiExtraction,
  now: Date,
  history?: MessageSummary[],
): AiExtraction {
  let service = extraction.service?.trim() || null;
  // If service was omitted in this turn, recover from previous turns if available
  if (!service) {
    service = recoverServiceFromHistory(history);
  }

  const requested_date = resolveRequestedDate(extraction.requested_date, now);
  const requested_time = resolveRequestedTime(extraction.requested_time);
  const missingFields = recomputeMissingFields(service, requested_date, requested_time);

  return {
    intent: extraction.intent,
    service,
    requested_date,
    requested_time,
    duration_minutes:
      extraction.duration_minutes === undefined ? null : extraction.duration_minutes,
    missingFields,
    clarification_question: extraction.clarification_question ?? null,
  };
}

const FALLBACK_TEXT =
  "I wasn't able to process that request just now. You can book or update your appointment using the form below.";

/** Maps a validated extraction to the contract response the chat service returns. */
function mapToResult(extraction: AiExtraction): AssistantAdapterResult {
  const {
    intent,
    service,
    requested_date: date,
    requested_time: time,
    duration_minutes: duration,
    missingFields,
    clarification_question,
  } = extraction;

  const proposalNull: AssistantBookingState['proposal'] = null;
  const collecting: BookingState = 'collecting_details';

  switch (intent) {
    case 'book_appointment': {
      if (missingFields.length === 0) {
        const durationPart = duration ? ` (${duration} min)` : '';
        return {
          text: `I've captured your request for ${service ?? 'an appointment'} on ${date} at ${time}${durationPart}. I'll check availability and prepare a proposal for your confirmation.`,
          booking: { state: collecting, missingFields, proposal: proposalNull },
          extraction,
        };
      }

      // Friendly fallback if the model did not supply clarification_question
      const friendlyMissing: string[] = [];
      if (missingFields.includes('service')) friendlyMissing.push('what service you would like');
      if (missingFields.includes('requested_date')) friendlyMissing.push('your preferred date');
      if (missingFields.includes('requested_time')) friendlyMissing.push('your preferred time');

      const naturalPrompt = `I'd be glad to help! Could you please let me know ${friendlyMissing.join(' and ')}?`;

      return {
        text: clarification_question || naturalPrompt,
        booking: { state: collecting, missingFields, proposal: proposalNull },
        extraction,
      };
    }
    case 'ask_question':
      return {
        text:
          clarification_question ||
          'I can help you book an appointment. What service and time would you like?',
        booking: { state: collecting, missingFields: [], proposal: proposalNull },
        extraction,
      };
    case 'cancel_appointment':
      return {
        text:
          clarification_question ||
          'I can help cancel an appointment. Please tell me the service and date of the appointment you want to cancel.',
        booking: { state: collecting, missingFields: [], proposal: proposalNull },
        extraction,
      };
    case 'unknown':
    default:
      return {
        text:
          clarification_question ||
          'I can help you schedule an appointment. What would you like to book?',
        booking: { state: collecting, missingFields: [], proposal: proposalNull },
        extraction,
      };
  }
}

/** Controlled fallback for every failure (no fabrication of booking details). */
function fallbackResult(): AssistantAdapterResult {
  return {
    text: FALLBACK_TEXT,
    booking: {
      state: 'needs_fallback',
      missingFields: [...MISSING_BOOKING_FIELDS],
      proposal: null,
    },
  };
}

function getChoiceContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  return typeof content === 'string' ? content : null;
}

function statusToOutcome(status: number): ExtractOutcome {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return 'provider_error';
}
type ChatMessageLike = { role: 'system' | 'user' | 'assistant'; content: string };

function getSystemPrompt(now: Date): string {
  const todayStr = formatDateInTz(now, BOOKING_TIMEZONE);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIMEZONE,
    weekday: 'long',
  }).format(now);

  return `You are "Appointment AI Extractor", an intelligent conversational assistant that helps users schedule appointments.
You extract structured booking fields from the conversation.

CURRENT CALENDAR CONTEXT:
- Today's date: ${weekday}, ${todayStr}
- Timezone: Asia/Karachi (PKT, UTC+5)
- Business hours: Monday to Friday, 09:00 to 17:00 (30-minute consultation slots)

Return EXACTLY one JSON object matching this schema and nothing else (no markdown, no backticks, only pure JSON):
{"intent":"book_appointment|ask_question|cancel_appointment|unknown","service":"string|null","requested_date":"YYYY-MM-DD|null","requested_time":"HH:mm|null","duration_minutes":number|null,"missingFields":["service","requested_date","requested_time"],"clarification_question":"string|null"}

RULES:
1. Multi-turn continuity: Consider the entire conversation history! When a user previously stated their desired service (e.g. "dental checkup", "consultation"), KEEP that service even if their latest message only provides the date or time.
2. Date extraction: Compute the exact YYYY-MM-DD date based on today (${todayStr}, ${weekday}). Convert relative days like "Monday", "next Monday", "tomorrow", "next Tuesday" to YYYY-MM-DD.
3. Time extraction: Convert times like "10am", "2:30pm", "14:00" to HH:mm (24-hour).
4. clarification_question: Always provide a warm, human, conversational response or follow-up question. Never mention raw internal field names like "requested_date" or "missingFields" to the user!
5. Never confirm or finalize the booking yourself; that is handled by the backend after the user reviews the proposal.`;
}

/**
 * Builds the bounded message list sent to the provider: a server-owned system
 * policy message + the most recent N history messages (truncated) + the current
 * user message.
 */
function buildMessages(content: string, history: MessageSummary[], now: Date): ChatMessageLike[] {
  const systemPrompt = getSystemPrompt(now);
  const system: ChatMessageLike = { role: 'system', content: systemPrompt };
  const recent = (history ?? []).slice(-MAX_HISTORY_MESSAGES);
  const out: ChatMessageLike[] = [system];
  let total = system.content.length;

  for (const m of recent) {
    const text =
      m.content.length > MAX_MESSAGE_CHARS
        ? m.content.slice(0, MAX_MESSAGE_CHARS) + '...[truncated]'
        : m.content;
    out.push({ role: m.role, content: text });
    total += text.length;
  }

  const userBudget = Math.max(0, MAX_TOTAL_INPUT_CHARS - total);
  const userText =
    content.length > userBudget
      ? content.slice(0, Math.max(0, userBudget)) + '...[truncated]'
      : content;
  out.push({ role: 'user', content: userText });
  return out;
}

async function callGroq(
  doFetch: FetchFn,
  apiKey: string,
  model: string,
  timeoutMs: number,
  messages: ChatMessageLike[],
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: ProviderResponse | undefined;
    try {
      response = await doFetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (isAbortError(err)) throw new GroqError('timeout');
      throw new GroqError('network_error');
    }

    if (!response) throw new GroqError('network_error');
    if (!response.ok) {
      throw new GroqError(statusToOutcome(response.status), response.status);
    }

    const data = await response.json().catch(() => {
      throw new GroqError('malformed_json');
    });
    const content = getChoiceContent(data);
    if (content === null) {
      throw new GroqError('malformed_json');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

const globalFetch = (globalThis as unknown as { fetch?: FetchFn }).fetch;
const defaultFetch: FetchFn =
  globalFetch ??
  (async (): Promise<ProviderResponse> => {
    throw new GroqError('network_error');
  });

/** M6: creates the production Groq-backed assistant adapter. */
export function createGroqAdapter(deps: GroqAdapterDeps): AssistantAdapter {
  const apiKey = deps.apiKey ?? '';
  const model = deps.model ?? DEFAULT_MODEL;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch: FetchFn = deps.fetch ?? defaultFetch;
  const now = deps.now ?? (() => new Date());
  const log = deps.logger ?? defaultLogger;

  return async (params): Promise<AssistantAdapterResult> => {
    const { content, history = [] } = params;
    const start = Date.now();
    try {
      if (!apiKey) throw new GroqError('missing_api_key');

      const currentDate = now();
      const messages = buildMessages(content, history, currentDate);
      const raw = await callGroq(doFetch, apiKey, model, timeoutMs, messages);
      const extraction = parseExtraction(raw, currentDate, history);
      const result = mapToResult(extraction);
      log({ provider: 'groq', model, latencyMs: Date.now() - start, outcome: 'success' });
      return result;
    } catch (err) {
      const failure = err instanceof GroqError ? err : new GroqError('provider_error');
      log({
        provider: 'groq',
        model,
        latencyMs: Date.now() - start,
        outcome: failure.outcome,
        status: failure.status,
      });
      return fallbackResult();
    }
  };
}

/** Safe default: one JSON line to stderr, never including secrets or payloads. */
function defaultLogger(entry: {
  provider: 'groq';
  model: string;
  latencyMs: number;
  outcome: ExtractOutcome;
  status?: number;
}): void {
  console.error(
    JSON.stringify({
      level: 'error',
      provider: entry.provider,
      model: entry.model,
      latencyMs: entry.latencyMs,
      outcome: entry.outcome,
      status: entry.status ?? undefined,
    }),
  );
}
