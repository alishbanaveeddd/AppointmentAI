/**
 * M4 — Zod validation schemas for appointment endpoints.
 *
 * Schemas for:
 * - createProposalSchema: POST /appointments/proposals
 *
 * Per docs/API_CONTRACT.md D-008, D-009:
 * - service: required non-empty string (max 200 chars)
 * - startsAt / endsAt: ISO 8601 date strings; endsAt must be exactly 30 minutes after startsAt
 * - timezone: optional, defaults to Asia/Karachi (D-008)
 * - durationMinutes: optional, defaults to 30 (D-008)
 * - expiresAt is computed server-side (15 min TTL, D-009)
 */
import { z } from 'zod';
import { BOOKING_TIMEZONE, APPOINTMENT_DURATION_MINUTES } from '../config/booking';

export const createProposalSchema = z.object({
  service: z
    .string()
    .min(1, 'Service is required')
    .max(200, 'Service must be at most 200 characters'),
  startsAt: z.coerce.date({
    error: 'startsAt must be a valid ISO 8601 date string',
  }),
  endsAt: z.coerce.date({
    error: 'endsAt must be a valid ISO 8601 date string',
  }),
  timezone: z.string().default(BOOKING_TIMEZONE),
  durationMinutes: z
    .number()
    .int()
    .positive('Duration must be a positive integer')
    .default(APPOINTMENT_DURATION_MINUTES),
}).refine(
  (data) =>
    data.endsAt.getTime() - data.startsAt.getTime() ===
    data.durationMinutes * 60 * 1000,
  {
    error: 'endsAt - startsAt must equal durationMinutes',
  },
);

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
