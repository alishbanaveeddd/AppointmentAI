/**
 * M4 — Booking policy configuration (D-008).
 *
 * Server-side business rules for appointment scheduling.
 * These values are NOT exposed via an admin UI.
 *
 * Per docs/DATABASE_DESIGN.md § Booking policy (D-008):
 * - Timezone: Asia/Karachi
 * - Business hours: Monday–Friday, 9:00 AM–5:00 PM (local)
 * - Duration: fixed 30-minute slots
 * - No past bookings: startsAt must be at or after current time
 * - Cancellation: permitted only if confirmed and ≥ 2 hours before startsAt
 *
 * Per docs/API_CONTRACT.md D-009:
 * - Booking proposals expire 15 minutes after creation unless confirmed.
 */

/** The business timezone used for all scheduling logic. */
export const BOOKING_TIMEZONE = 'Asia/Karachi';

/** Business hours start (9 AM, inclusive in 24h). */
export const BUSINESS_HOURS_START = 9;

/** Business hours end (5 PM, exclusive in 24h; last 30-min slot starts at 16:30). */
export const BUSINESS_HOURS_END = 17;

/** Working days: Monday=1 … Friday=5 (JS getDay: 0=Sun, 1=Mon, …, 6=Sat). */
export const WORKING_DAYS: ReadonlyArray<number> = [1, 2, 3, 4, 5];

/** Fixed appointment duration in minutes (D-008). */
export const APPOINTMENT_DURATION_MINUTES = 30;

/** Cancellation must be at least this many hours before the appointment (D-008). */
export const CANCELLATION_CUTOFF_HOURS = 2;

/** How long a booking proposal remains valid before expiring (D-009). */
export const PROPOSAL_TTL_MINUTES = 15;

/** Proposal TTL in milliseconds (derived). */
export const PROPOSAL_TTL_MS = PROPOSAL_TTL_MINUTES * 60 * 1000;

/** Cancellation cutoff in milliseconds (derived). */
export const CANCELLATION_CUTOFF_MS = CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000;

/** Duration in milliseconds (derived). */
export const APPOINTMENT_DURATION_MS = APPOINTMENT_DURATION_MINUTES * 60 * 1000;

interface TimezoneInfo {
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  hour: number;      // 0-23 (24-hour cycle)
  minute: number;    // 0-59
}

const weekdayMap: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Returns the timezone-local weekday, hour, and minute for a given Date
 * in the specified IANA timezone, using the WHATWG Intl API.
 */
export function getTimezoneInfo(
  date: Date,
  timezone: string = BOOKING_TIMEZONE,
): TimezoneInfo {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
    hour: parseInt(map.hour ?? '0', 10),
    minute: parseInt(map.minute ?? '0', 10),
  };
}

/**
 * Returns true when the given Date, interpreted in `timezone` (default
 * Asia/Karachi), falls on a working day within business hours AND a 30-minute
 * appointment starting at that time fits entirely within the 9 AM–5 PM window.
 */
export function isWithinBusinessHours(
  date: Date,
  timezone: string = BOOKING_TIMEZONE,
): boolean {
  const info = getTimezoneInfo(date, timezone);

  // Must be Mon–Fri
  if (!WORKING_DAYS.includes(info.dayOfWeek)) return false;

  // Start hour must be within [9, 17)
  if (info.hour < BUSINESS_HOURS_START || info.hour >= BUSINESS_HOURS_END) {
    return false;
  }

  // The 30-minute slot must end by 17:00
  const startMinutes = info.hour * 60 + info.minute;
  const endMinutes = startMinutes + APPOINTMENT_DURATION_MINUTES;
  if (endMinutes > BUSINESS_HOURS_END * 60) return false;

  return true;
}

/**
 * Returns true if the string is a valid IANA timezone name.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
