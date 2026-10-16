/**
 * M8 — Date / time formatting utilities.
 *
 * Per docs/ARCHITECTURE.md D-008: Asia/Karachi is the business timezone
 * for ALL scheduling logic and display. The server enforces it; the frontend
 * only formats UTC ISO strings for display in Asia/Karachi.
 *
 * Pakistan Standard Time (UTC+5) observes no DST.
 */

export const BOOKING_TIMEZONE = 'Asia/Karachi';

/** Cancellation cutoff: 2 hours before the appointment start. */
const CANCELLATION_CUTOFF_MS = 2 * 60 * 60 * 1000;

/**
 * Format a date string as "Mon, Jan 1, 2026, 10:30 AM PKT" in Asia/Karachi.
 */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(d);
}

/**
 * Format a date string as "Mon, Jan 1, 2026" (date only) in Asia/Karachi.
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date string as "10:30 AM" (time only) in Asia/Karachi.
 */
export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Returns true if an appointment is eligible for cancellation:
 * it must be confirmed AND start at least 2 hours in the future.
 */
export function isCancellable(startsAt: string): boolean {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  return start - now > CANCELLATION_CUTOFF_MS;
}

/**
 * Returns the human-readable reason why cancellation is not allowed.
 */
export function getCancellationBlockReason(
  startsAt: string,
  status: string,
): string | null {
  if (status !== 'confirmed') {
    return 'Only confirmed appointments can be cancelled.';
  }
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  const diffMs = start - now;
  if (diffMs <= 0) {
    return 'This appointment has already started or passed.';
  }
  if (diffMs <= CANCELLATION_CUTOFF_MS) {
    const hours = Math.ceil(diffMs / (60 * 60 * 1000));
    const plural = hours > 1 ? 's' : '';
    return `Cancellations must be made at least 2 hours before the appointment start (this one is in ${hours} hour${plural}).`;
  }
  return null;
}

/**
 * Checks whether a proposal has expired (returns remaining time or null).
 */
export function getProposalTimeRemaining(
  expiresAt: string,
): string | null {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const remaining = expiry - now;
  if (remaining <= 0) return null;

  const minutes = Math.floor(remaining / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}