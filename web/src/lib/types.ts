/**
 * M8 — Shared TypeScript types for the Appointment AI frontend.
 *
 * These types mirror the response shapes of the API defined in
 * docs/API_CONTRACT.md and the Zod schemas in api/src/schemas/.
 * Date fields are serialized as ISO strings in JSON; they are typed
 * as `string` on the frontend and formatted via src/lib/date.ts.
 */

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: User;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/* ------------------------------------------------------------------ *
 * Chat
 * ------------------------------------------------------------------ */

export interface ChatSession {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export type BookingState =
  | 'collecting_details'
  | 'awaiting_confirmation'
  | 'booked'
  | 'cancelled'
  | 'needs_fallback';

export interface ProposalInfo {
  proposalId: string;
  service: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  durationMinutes: number;
  expiresAt: string;
}

export interface BookingInfo {
  state: BookingState;
  missingFields: string[];
  proposal: ProposalInfo | null;
}

export interface ChatResponse {
  message: ChatMessage;
  booking: BookingInfo;
  appointment?: Appointment;
}

/* ------------------------------------------------------------------ *
 * Appointments
 * ------------------------------------------------------------------ */

export interface Proposal {
  proposalId: string;
  userId: string;
  service: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  durationMinutes: number;
  expiresAt: string;
  status: string;
}

export interface Appointment {
  id: string;
  service: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface CreateProposalInput {
  service: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  durationMinutes?: number;
}

export interface ConfirmationResult {
  appointment: Appointment;
  isNew: boolean;
}

export interface CancellationResult {
  appointment: Appointment;
}

/* ------------------------------------------------------------------ *
 * Error / API
 * ------------------------------------------------------------------ */

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    conflict?: {
      type: 'slot_unavailable' | 'stale_proposal' | 'proposal_expired';
      proposalId: string | null;
    };
  };
}