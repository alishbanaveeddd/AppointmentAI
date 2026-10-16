# Database Design

> **Authoritative schema:** `prisma/schema.prisma` with Prisma migrations (D-007).
> PostgreSQL-specific features that the Prisma migrate DSL cannot express — most
> notably the booking-overlap exclusion constraint (D-006) — are applied as
> **reviewed custom SQL migrations**.
> `database/schema.sql` is **reference-only/illustrative** and must not be treated
> as the implementation artifact.

## Core entities
- `User`: account and profile.
- `ChatSession`: conversation metadata and ownership.
- `ChatMessage`: one user or assistant message per row.
- `Appointment`: requested service, time range, status, and ownership.
  - Status values: `confirmed` (active), `cancelled`, `completed`.
  - Only `confirmed` appointments participate in overlap protection (D-006).
- `BookingProposal` (D-009): a transient proposal with a unique `proposalId`, proposed appointment details, a defined expiry (TTL), and a status (`pending`, `confirmed`, `expired`, `invalidated`). Proposals are not appointments until explicit confirmation succeeds.

## Relationships
- User 1:N ChatSession
- ChatSession 1:N ChatMessage
- User 1:N Appointment
- User 1:N BookingProposal (a user may have multiple pending proposals; only one confirmed appointment per confirmed time slot)

## Data modeling principles
- Use UUID primary keys.
- Store password hashes only.
- Use `TIMESTAMPTZ` for appointment instants.
- Use check constraints for valid status and positive time ranges.
- Use foreign keys to preserve referential integrity.
- Store conversation messages as rows rather than a growing JSON array.
- Keep indexes aligned with actual query patterns.
- Add `business_id` only if tenant isolation is implemented end to end.
- The authoritative schema lives in `prisma/schema.prisma`; custom SQL migrations document PostgreSQL-specific constraints.

## Index strategy
- Unique index on user email.
- `(user_id, updated_at DESC)` on chat sessions for a user's recent sessions.
- `(session_id, created_at)` on messages for ordered history.
- `(user_id, starts_at DESC)` on appointments for user schedules.
- `(user_id, expires_at, status)` on `booking_proposals` for pending/active proposal lookups and TTL cleanup.
- Add indexes only after checking actual query patterns; every index adds write and storage overhead.

> **Note — documentation vs. schema discrepancy (M2 reconciliation item):** `DATABASE_DESIGN.md` documents a `(user_id, expires_at, status)` index on `booking_proposals`, but `database/schema.sql` does **not** include this index. `schema.sql` contains indexes only for `chat_sessions`, `chat_messages`, and `appointments`. The authoritative schema is `prisma/schema.prisma` (D-007). During M2: (1) compare `database/schema.sql` against this design document; (2) ensure `schema.prisma` includes `@@index([userId, expiresAt, status])`; (3) verify the generated migration SQL creates the index. Do not invent a replacement or alter the approved design — this is an M2 reconciliation step, not an M1 action.

## Appointment overlap protection (D-006)
A basic `starts_at`/`ends_at` check followed by an insert is **not safe under concurrent requests**. The decided approach is a **PostgreSQL exclusion constraint** on the shared booking calendar, combined with backend revalidation and a structured 409 Conflict response.

### Exclusion constraint migration (custom SQL)
Because Prisma's migrate DSL cannot express exclusion constraints, this is applied as a **reviewed custom SQL migration** (not in `database/schema.sql`):

```sql
-- Requires the btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevents overlapping confirmed appointments on the shared calendar.
-- Only 'confirmed' rows participate; 'cancelled' and 'completed' are excluded.
ALTER TABLE appointments
    ADD CONSTRAINT no_overlapping_confirmed_appointments
    EXCLUDE USING GIST (tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status = 'confirmed');
```

**Status semantics:** The partial index filter `WHERE (status = 'confirmed')` ensures that only active/confirmed appointments block new bookings. Cancelled and completed appointments do not prevent rebooking of the same time slot.

**Half-open range:** `tstzrange(starts_at, ends_at)` produces a `[start, end)` range by default, so an appointment ending at 10:30 and another starting at 10:30 are adjacent but not conflicting.

**Backend responsibility:** Before inserting, the booking service revalidates business hours, duration, and availability. If the exclusion constraint or availability check fails, the API returns HTTP 409 with a structured `CONFLICT` error (see `API_CONTRACT.md`).

Do not claim conflict prevention until concurrency tests demonstrate it.

## Booking policy (D-008)
The booking service owns the source of truth for scheduling rules. These are server-side configured and not exposed to any admin UI:
- **Timezone:** `Asia/Karachi`.
- **Business hours:** Monday–Friday, 9:00 AM–5:00 PM (local).
- **Duration:** fixed 30-minute slots.
- **No past bookings:** `starts_at` must be at or after the current time.
- **Cancellation:** permitted only if the appointment is `confirmed` and at least two hours remain before `starts_at`.

## Booking proposal lifecycle (D-009)
Proposals are tracked in a `booking_proposals` table (authoritative model in `prisma/schema.prisma`; illustrative reference SQL in `database/schema.sql`) to support uniqueness, expiry, and idempotency:
- `proposal_id` (UUID, PK) — unique proposal identifier.
- `user_id` (FK) — owner.
- `service`, `starts_at`, `ends_at` (TIMESTAMPTZ) — proposed appointment details.
- `timezone`, `duration_minutes` — scheduling context.
- `expires_at` (TIMESTAMPTZ) — TTL after which the proposal is stale.
- `status` — `pending` | `confirmed` | `expired` | `invalidated`.
- `appointment_id` (FK, nullable) — set when confirmation succeeds.
- Check constraint: `ends_at > starts_at` and `ends_at - starts_at = interval '30 minutes'`.

**Lifecycle:**
1. `POST /appointments/proposals` creates a `pending` proposal with `expires_at = now() + TTL`.
2. A change in booking details invalidates the old proposal (`invalidated`).
3. `POST /appointments/proposals/:id/confirm` revalidates all rules; on success, creates the `Appointment` and marks the proposal `confirmed`. Repeated confirmation is idempotent (returns the same appointment).
4. A proposal that reaches `expires_at` while still `pending` is treated as `expired` → HTTP 409.
5. AI output alone never creates an appointment; only explicit confirmation persists (D-009).

### Reference SQL (reference-only)
An illustrative `booking_proposals` table is included in `database/schema.sql` for design review. The authoritative Prisma model is in `prisma/schema.prisma`. Both define the same fields below:

## Sample data
Seed scripts must create a demo user with a real generated password hash, one chat session, sample messages, and sample appointments. Never ship a placeholder hash as a working credential.

## Performance notes
The expected assessment load is small. Correctness, constraints, query clarity, and avoiding N+1 calls matter more than caching. Bound conversation history sent to the LLM and paginate long histories if implemented.
