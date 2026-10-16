/**
 * M6 — Structured AI extraction schema (D-010).
 *
 * This Zod schema is the source of truth for validating EVERY object returned
 * by the Groq adapter. It mirrors the "Suggested output schema" contract in
 * `docs/AI_WORKFLOW.md`. Field naming follows that contract; the
 * `missingFields` entries are the canonical booking-field identifiers already
 * used by M5 (`service`, `requested_date`, `requested_time`) so downstream
 * consumers and existing tests stay consistent (see AI_WORKFLOW, "Canonical
 * property naming convention").
 *
 * Per D-010: model output is untrusted. A parse/validation failure here drives
 * the safe fallback path in the Groq adapter — it never reaches business
 * logic or persistence paths.
 */
import { z } from 'zod';

export const AiIntentSchema = z.enum([
  'book_appointment',
  'ask_question',
  'cancel_appointment',
  'unknown',
]);

// The canonical booking fields the assistant may still be missing (matches M5
// and docs/AI_WORKFLOW.md; NOT user-configurable).
export const BookingFieldSchema = z.enum(['service', 'requested_date', 'requested_time']);

export const AiExtractionSchema = z.object({
  intent: AiIntentSchema,
  service: z.string().nullable(),
  requested_date: z.string().nullable(),
  requested_time: z.string().nullable(),
  duration_minutes: z
    .number()
    .int('duration_minutes must be an integer')
    .positive('duration_minutes must be a positive integer')
    .nullable()
    .optional(),
  missingFields: z.array(BookingFieldSchema).optional().default([]),
  clarification_question: z.string().nullable().optional(),
});

export type AiExtraction = z.infer<typeof AiExtractionSchema>;
export type AiIntent = z.infer<typeof AiIntentSchema>;
export type BookingField = z.infer<typeof BookingFieldSchema>;

/**
 * Internal, non-sensitive outcome codes used for safe single-line logging.
 * These NEVER include the provider key, the request body, the request URL
 * (beyond the provider host), or raw model output (per docs/SECURITY.md,
 * AI-specific protection + Observability).
 */
export type ExtractOutcome =
  | 'success'
  | 'timeout'
  | 'rate_limited'
  | 'server_error'
  | 'provider_error'
  | 'network_error'
  | 'malformed_json'
  | 'validation_failed'
  | 'missing_api_key';
