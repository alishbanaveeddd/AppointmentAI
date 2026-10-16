/**
 * M5 — Chat session and message service.
 *
 * Encapsulates chat business logic: session creation, session listing,
 * message history retrieval, and message sending with a pluggable assistant
 * adapter (fake deterministic in M5; Groq-backed in M6).
 *
 * Per docs/AI_WORKFLOW.md:
 * - The assistant adapter is a fake deterministic implementation initially.
 *   Real Groq extraction is deferred to M6.
 * - AI output is untrusted; the deterministic adapter cannot override
 *   server-owned state or create proposals (that's M7).
 * - Conversation state is tracked server-side in session metadata.
 *
 * Per docs/API_CONTRACT.md:
 * - All endpoints require authentication.
 * - Session ownership is enforced server-side (404 for non-owned sessions).
 */
import type { PrismaClient } from '@prisma/client';
import {
  type AppointmentService,
  type ProposalResult,
  type AppointmentSummary,
  SlotConflictError,
  ProposalExpiredError,
  ProposalInvalidatedError,
  ProposalNotFoundError,
  BusinessHoursViolationError,
  PastAppointmentError,
  InvalidDurationError,
} from './appointment';
import type { AiExtraction } from '../schemas/ai';
import {
  BOOKING_TIMEZONE,
  APPOINTMENT_DURATION_MS,
  APPOINTMENT_DURATION_MINUTES,
} from '../config/booking';

/* ------------------------------------------------------------------ *
 * Domain errors
 * ------------------------------------------------------------------ */

export class SessionNotFoundError extends Error {
  constructor() {
    super('Session not found.');
    this.name = 'SessionNotFoundError';
  }
}

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type MessageRole = 'user' | 'assistant';

export type BookingState =
  'collecting_details' | 'awaiting_confirmation' | 'booked' | 'cancelled' | 'needs_fallback';

export interface SessionSummary {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageSummary {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

/**
 * Proposal info surfaced in the booking state when a proposal is created (M7).
 */
export interface ProposalInfo {
  proposalId: string;
  service: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  durationMinutes: number;
  expiresAt: Date;
}

/**
 * Booking state returned alongside the assistant message.
 * M7: `proposal` carries ProposalInfo when a proposal has been created.
 */
export interface AssistantBookingState {
  state: BookingState;
  missingFields: string[];
  proposal: ProposalInfo | null;
}

export interface ChatResponse {
  message: MessageSummary;
  booking: AssistantBookingState;
  /** M7: present when confirmation succeeds. */
  appointment?: AppointmentSummary;
}

/**
 * Result returned by the assistant adapter.
 */
export interface AssistantAdapterResult {
  text: string;
  booking: AssistantBookingState;
  /** M7: validated AI extraction (present when the adapter performs extraction). */
  extraction?: AiExtraction;
}

/**
 * Adapter interface for the assistant.
 * M5: fake deterministic adapter.
 * M6: real Groq adapter with timeout/error handling.
 */
export type AssistantAdapter = (params: {
  content: string;
  history: MessageSummary[];
}) => Promise<AssistantAdapterResult>;

export interface ChatServiceDeps {
  prisma: PrismaClient;
  assistantAdapter?: AssistantAdapter;
  /** M7: shared appointment service for proposal creation/confirmation. */
  appointmentService?: AppointmentService;
}

/* ------------------------------------------------------------------ *
 * Deterministic fake assistant adapter (replaced by Groq in M6)
 * ------------------------------------------------------------------ */

const BOOKING_KEYWORDS = [
  'book',
  'appointment',
  'schedule',
  'slot',
  'consultation',
  'meeting',
  'reserve',
];

// Bounded context: number of recent messages passed to the assistant adapter (M6).
const CHAT_HISTORY_LIMIT = 10;

/**
 * Deterministic fake assistant adapter.
 *
 * Examines the user's message and returns a predictable assistant response.
 * For M5, the assistant always reports `collecting_details` state because
 * real field extraction is deferred to M6 (Groq adapter).
 *
 * This function is pure: identical input always produces identical output.
 */
export function fakeAssistantAdapter(content: string): AssistantAdapterResult {
  const lower = content.toLowerCase();
  const isBookingRequest = BOOKING_KEYWORDS.some((kw) => lower.includes(kw));

  const baseBooking: AssistantBookingState = {
    state: 'collecting_details',
    missingFields: ['service', 'requested_date', 'requested_time'],
    proposal: null,
  };

  if (isBookingRequest) {
    return {
      text:
        "I'd be happy to help you book an appointment! I'll need a few details: " +
        'the type of service, your preferred date, and time. What would you like?',
      booking: baseBooking,
    };
  }

  if (lower.includes('hello') || lower.includes('hi')) {
    return {
      text: "Hello! I'm your appointment booking assistant. How can I help you today?",
      booking: baseBooking,
    };
  }

  if (lower.includes('bye') || lower.includes('goodbye')) {
    return {
      text: 'Goodbye! Let me know if you need anything else.',
      booking: baseBooking,
    };
  }

  return {
    text:
      'How can I help you today? I can assist with booking appointments, ' +
      'checking availability, or answering questions.',
    booking: baseBooking,
  };
}

/** Wraps the synchronous fake adapter in the async interface. */
function defaultAdapter(params: {
  content: string;
  history: MessageSummary[];
}): Promise<AssistantAdapterResult> {
  return Promise.resolve(fakeAssistantAdapter(params.content));
}

/* ------------------------------------------------------------------ *
 * M7 — Booking workflow helpers
 * ------------------------------------------------------------------ */

/** Canonical booking field identifiers (matches schemas/ai.ts). */
const MISSING_BOOKING_FIELDS: string[] = ['service', 'requested_date', 'requested_time'];

/** Patterns indicating the user is confirming a proposal. */
const CONFIRM_PATTERNS: RegExp[] = [
  /\byes\b/i,
  /\byeah\b/i,
  /\byep\b/i,
  /\bsure\b/i,
  /\bconfirm(ation|ed)?\b/i,
  /\bokay?\b/i,
  /\bgo ahead\b/i,
  /\bbook it\b/i,
  /\bthat'?s good\b/i,
  /\bthat work/i,
  /\bsounds good\b/i,
  /\bproceed\b/i,
  /\bi'm in\b/i,
  /\blet'?s do it\b/i,
];

/** Patterns indicating the user is declining / changing their mind. */
const NEGATE_PATTERNS: RegExp[] = [
  /\bno\b/i,
  /\bnope\b/i,
  /\bcancel\b/i,
  /\bnot now\b/i,
  /\bchange\b/i,
  /\bdifferent\b/i,
];

/** Returns true when the user's message looks like a confirmation. */
function isConfirmationMessage(content: string): boolean {
  const msg = content.trim().toLowerCase();
  return CONFIRM_PATTERNS.some((p) => p.test(msg));
}

/** Returns true when the user's message indicates decline / change of mind. */
function isNegationMessage(content: string): boolean {
  const msg = content.trim().toLowerCase();
  return NEGATE_PATTERNS.some((p) => p.test(msg));
}

/** Shape of booking state stored in ChatSession.metadata. */
interface SessionBookingState {
  state: BookingState;
  proposalId: string | null;
}

/**
 * Reads booking state from a ChatSession's `metadata` JSON field.
 * Falls back to `collecting_details` / no proposalId when absent or malformed.
 */
function getSessionBookingState(metadata: unknown): SessionBookingState {
  try {
    if (!metadata || typeof metadata !== 'object') {
      return { state: 'collecting_details', proposalId: null };
    }
    const meta = metadata as Record<string, unknown>;
    const booking = meta.booking as Record<string, unknown> | undefined;
    if (!booking) {
      return { state: 'collecting_details', proposalId: null };
    }
    const state = booking.state;
    const proposalId = booking.proposalId;
    return {
      state: typeof state === 'string' ? (state as BookingState) : 'collecting_details',
      proposalId: typeof proposalId === 'string' ? proposalId : null,
    };
  } catch {
    return { state: 'collecting_details', proposalId: null };
  }
}

/** Builds a new metadata object with updated booking state. */
function setSessionBookingState(
  metadata: unknown,
  state: BookingState,
  proposalId: string | null,
  // Return type is `any` because Prisma's InputJsonValue union doesn't
  // accept Record<string, unknown>; the runtime value is always valid JSON.
): any {
  const base = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  return {
    ...base,
    booking: { state, proposalId },
  };
}

/**
 * Converts a schema-valid `requested_date` ("YYYY-MM-DD") and `requested_time`
 * ("HH:mm") into a `Date` interpreting those values in the business timezone
 * (Asia/Karachi, UTC+5, no DST).
 */
function resolveProposalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  // Asia/Karachi = UTC+5 (Pakistan Standard Time, no DST)
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute, 0, 0));
}

/**
 * Formats a Date into Asia/Karachi `{ date: "YYYY-MM-DD", time: "HH:mm" }`.
 */
function formatKarachiDateTime(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

/** Converts a ProposalResult into the chat-layer ProposalInfo. */
function toProposalInfo(result: ProposalResult): ProposalInfo {
  return {
    proposalId: result.proposalId,
    service: result.service,
    startsAt: result.startsAt,
    endsAt: result.endsAt,
    timezone: result.timezone,
    durationMinutes: result.durationMinutes,
    expiresAt: result.expiresAt,
  };
}

/* ------------------------------------------------------------------ *
 * Factory
 * ------------------------------------------------------------------ */

export function createChatService({ prisma, assistantAdapter = defaultAdapter, appointmentService }: ChatServiceDeps) {
  /**
   * Safely looks up a session, treating invalid UUID format (P2023) as
   * "not found" so callers can uniformly handle both missing and malformed IDs.
   */
  async function safeFindSession(sessionId: string) {
    try {
      return await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2023'
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Verifies session ownership. Throws SessionNotFoundError for missing,
   * malformed, or non-owned session IDs (uniform 404 policy per
   * API_CONTRACT.md).
   */
  async function verifyOwnership(userId: string, sessionId: string) {
    const session = await safeFindSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundError();
    }
    return session;
  }

  /**
   * Creates a new chat session for the given user.
   * If no title is provided, the title is left null and auto-generated
   * when the first message is sent.
   */
  async function createSession(userId: string, title?: string): Promise<SessionSummary> {
    const session = await prisma.chatSession.create({
      data: {
        userId,
        title: title ?? null,
      },
    });

    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Lists all chat sessions for the current user, ordered by most recently
   * updated first (matches DATABASE_DESIGN.md index strategy).
   */
  async function listSessions(userId: string): Promise<SessionSummary[]> {
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Retrieves the ordered message history for a session.
   * Messages are returned oldest-first, ascending by created_at.
   * Ownership is verified — non-owners receive a 404.
   */
  async function getMessages(userId: string, sessionId: string): Promise<MessageSummary[]> {
    await verifyOwnership(userId, sessionId);

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as MessageRole,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Sends a user message to a session and receives the assistant response.
   *
   * M7 flow:
   * 1. Verify session ownership.
   * 2. Fetch a bounded slice of recent messages as conversation context.
   * 3. Read server-side booking state from session metadata.
   * 4. If the message is a confirmation/negation AND a proposal is pending,
   *    call confirmProposal / cancel the proposal flow accordingly.
   * 5. Otherwise, call the assistant adapter for extraction. If the extraction
   *    is complete (all booking fields present), call createProposal.
   * 6. Transaction: persist both messages + update session metadata.
   * 7. Return the assistant message + enriched booking state.
   *
   * Per docs/AI_WORKFLOW.md: AI output alone never creates or confirms a booking.
   * All business rules, expiry checks, and availability validation are
   * performed by the appointment service (the authoritative check).
   */
  async function sendMessage(
    userId: string,
    sessionId: string,
    content: string,
  ): Promise<ChatResponse> {
    // 1. Verify ownership
    const session = await verifyOwnership(userId, sessionId);

    const trimmed = content.trim();

    // 2. Fetch a bounded slice of recent messages for the adapter's context.
    //    M6: the real Groq adapter uses this history; the fake adapter
    //    ignores it, preserving existing deterministic behavior.
    const recent = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: -CHAT_HISTORY_LIMIT,
    });
    const history: MessageSummary[] = recent.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as MessageRole,
      content: m.content,
      createdAt: m.createdAt,
    }));

    // 3. Read server-side booking state from session metadata
    const sessionState = getSessionBookingState(session.metadata);

    const isConfirm = isConfirmationMessage(trimmed);
    const isNegate = isNegationMessage(trimmed);

    let messageText: string;
    let bookingState: AssistantBookingState;
    let appointment: AppointmentSummary | undefined;
    let newSessionState: SessionBookingState | null = null;

    // 4. Handle confirmation / negation of a pending proposal
    if (appointmentService && sessionState.proposalId && (isConfirm || isNegate)) {
      if (isConfirm) {
        try {
          const { appointment: appt, isNew } = await appointmentService.confirmProposal(
            userId,
            sessionState.proposalId,
          );
          appointment = appt;
          const { date, time } = formatKarachiDateTime(appt.startsAt);
          messageText = isNew
            ? `✅ Your ${appt.service} appointment is confirmed for ${date} at ${time}.`
            : `✅ Your ${appt.service} appointment is already confirmed for ${date} at ${time}.`;
          bookingState = { state: 'booked', missingFields: [], proposal: null };
          newSessionState = { state: 'booked', proposalId: null };
        } catch (err) {
          if (err instanceof ProposalExpiredError) {
            messageText =
              "That proposal has expired. Let's start over — what service and time would you like?";
            bookingState = {
              state: 'collecting_details',
              missingFields: [...MISSING_BOOKING_FIELDS],
              proposal: null,
            };
            newSessionState = { state: 'collecting_details', proposalId: null };
          } else if (err instanceof SlotConflictError) {
            messageText =
              "That time slot is no longer available. Please tell me a different date or time.";
            bookingState = {
              state: 'awaiting_confirmation',
              missingFields: ['requested_date', 'requested_time'],
              proposal: null,
            };
            newSessionState = { state: 'awaiting_confirmation', proposalId: null };
          } else if (err instanceof ProposalInvalidatedError) {
            messageText =
              "That proposal is no longer valid. What date and time would work for you?";
            bookingState = {
              state: 'collecting_details',
              missingFields: [...MISSING_BOOKING_FIELDS],
              proposal: null,
            };
            newSessionState = { state: 'collecting_details', proposalId: null };
          } else if (err instanceof ProposalNotFoundError) {
            messageText =
              "I couldn't find that proposal. Let's start fresh — what would you like to book?";
            bookingState = {
              state: 'collecting_details',
              missingFields: [...MISSING_BOOKING_FIELDS],
              proposal: null,
            };
            newSessionState = { state: 'collecting_details', proposalId: null };
          } else {
            throw err;
          }
        }
      } else {
        // Negation: user said "no" / "cancel" while awaiting confirmation
        messageText =
          "Okay, I've set that aside. Let me know if you'd like to try a different time.";
        bookingState = {
          state: 'collecting_details',
          missingFields: [...MISSING_BOOKING_FIELDS],
          proposal: null,
        };
        newSessionState = { state: 'collecting_details', proposalId: null };
      }
    } else {
      // 5. Normal flow: call the assistant adapter with the latest message
      const assistantResult = await assistantAdapter({
        content: trimmed,
        history,
      });
      messageText = assistantResult.text;
      bookingState = assistantResult.booking;

      // Check for complete extraction → create proposal
      if (
        appointmentService &&
        assistantResult.extraction &&
        assistantResult.extraction.intent === 'book_appointment' &&
        assistantResult.extraction.missingFields.length === 0
      ) {
        const { service, requested_date, requested_time, duration_minutes } =
          assistantResult.extraction;
        try {
          const startsAt = resolveProposalDateTime(requested_date!, requested_time!);
          const endsAt = new Date(startsAt.getTime() + APPOINTMENT_DURATION_MS);
          const durationMin = duration_minutes ?? APPOINTMENT_DURATION_MINUTES;

          const proposal = await appointmentService.createProposal(userId, {
            service: service!,
            startsAt,
            endsAt,
            timezone: BOOKING_TIMEZONE,
            durationMinutes: durationMin,
          });

          const { date, time } = formatKarachiDateTime(proposal.startsAt);
          messageText = `I've prepared a proposal for ${proposal.service} on ${date} at ${time}. Shall I confirm this appointment?`;
          bookingState = {
            state: 'awaiting_confirmation',
            missingFields: [],
            proposal: toProposalInfo(proposal),
          };
          newSessionState = {
            state: 'awaiting_confirmation',
            proposalId: proposal.proposalId,
          };
        } catch (err) {
          if (err instanceof BusinessHoursViolationError) {
            messageText =
              "I can only schedule appointments Monday–Friday, 9 AM–5 PM (Asia/Karachi). What date and time would work for you?";
            bookingState = {
              state: 'collecting_details',
              missingFields: ['requested_date', 'requested_time'],
              proposal: null,
            };
          } else if (err instanceof PastAppointmentError) {
            messageText =
              "That time has already passed. Please choose a future date and time.";
            bookingState = {
              state: 'collecting_details',
              missingFields: ['requested_date', 'requested_time'],
              proposal: null,
            };
          } else if (err instanceof InvalidDurationError) {
            messageText =
              "I can only schedule 30-minute appointments. Please provide a different time.";
            bookingState = {
              state: 'collecting_details',
              missingFields: ['requested_date', 'requested_time'],
              proposal: null,
            };
          } else {
            throw err;
          }
        }
      }

      // Re-present pending proposal if the user asked a non-booking question
      const isNewBookingAttempt =
        assistantResult.extraction?.intent === 'book_appointment';
      if (
        !newSessionState &&
        sessionState.state === 'awaiting_confirmation' &&
        sessionState.proposalId &&
        appointmentService &&
        !isNewBookingAttempt
      ) {
        try {
          const existing = await appointmentService.getProposal(
            userId,
            sessionState.proposalId,
          );
          if (existing.status === 'pending') {
            const { date, time } = formatKarachiDateTime(existing.startsAt);
            bookingState = {
              state: 'awaiting_confirmation',
              missingFields: [],
              proposal: toProposalInfo(existing),
            };
            messageText =
              assistantResult.text +
              ` (Previously proposed: ${existing.service} on ${date} at ${time}. Reply "yes" to confirm or tell me a different time.)`;
            newSessionState = {
              state: 'awaiting_confirmation',
              proposalId: sessionState.proposalId,
            };
          }
        } catch {
          // Proposal no longer exists; fall through
        }
      }
    }

    // 6. Transaction: persist both messages + update session metadata
    const result = await prisma.$transaction(async (tx) => {
      // Auto-generate title from first user message if none set
      if (!session.title) {
        const titleText = trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed;
        await tx.chatSession.update({
          where: { id: sessionId },
          data: { title: titleText },
        });
      }

      // Update session metadata if booking state changed
      if (newSessionState) {
        await tx.chatSession.update({
          where: { id: sessionId },
          data: {
            metadata: setSessionBookingState(
              session.metadata,
              newSessionState.state,
              newSessionState.proposalId,
            ),
          },
        });
      }

      await tx.chatMessage.create({
        data: {
          sessionId,
          role: 'user',
          content: trimmed,
        },
      });

      const assistantMessage = await tx.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: messageText,
        },
      });

      return { assistantMessage };
    });

    // 7. Return response
    const response: ChatResponse = {
      message: {
        id: result.assistantMessage.id,
        sessionId: result.assistantMessage.sessionId,
        role: 'assistant',
        content: result.assistantMessage.content,
        createdAt: result.assistantMessage.createdAt,
      },
      booking: bookingState,
    };

    if (appointment) {
      response.appointment = appointment;
    }

    return response;
  }

  return {
    createSession,
    listSessions,
    getMessages,
    sendMessage,
  };
}
