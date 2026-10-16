# Test Strategy

## Testing principles
- Tests must be deterministic and repeatable.
- Mock external AI calls in most automated tests; keep a separate optional live-provider smoke test.
- Test business rules independently of HTTP and UI.
- Do not mark tests passed without execution evidence.
- Use a test database isolated from development data.

## Layers

### 1. Static checks
- TypeScript typecheck
- ESLint
- Prettier check
- Build

### 2. Unit tests
- Password validation and hashing wrapper
- JWT/auth helpers
- Environment schema: rejects missing `NODE_ENV`, rejects empty `NODE_ENV`, rejects unsupported `NODE_ENV` values (only `development`, `test`, `production` are valid); accepts supported values and applies `PORT` default of `8000`. Does not reveal secret values in error messages.
- Request schemas
- AI output parsing and invalid-output handling (including proposalId)
- Relative-date parsing with a controlled clock/timezone
- Booking rules and allowed durations (business hours, 30-min slots, no past bookings)
- Cancellation policy (2-hour cutoff before start, D-008)
- Booking state transitions
- Error mapping

### 3. API integration tests
- Signup/login/logout/me
- Authentication middleware
- Session ownership
- Message persistence and history ordering
- AI failure fallback
- Appointment create/list/retrieve/cancel
- Validation errors and status codes
- Conflict handling and concurrent booking attempts
- Proposal creation, retrieval, and expiry (D-009)
- Confirmation idempotency: confirming twice returns the same appointment (D-009)
- Stale/expired proposal returns 409 (D-009)
- Cancellation eligibility: blocked within 2 hours of start (D-008)

### 4. Frontend tests
- Form validation and disabled/loading states
- Chat renders messages and preserves draft on error
- Booking proposal shows exact details including unique proposal ID (D-009)
- Confirmation UI changes only after server success
- Cancellation button reflects 2-hour eligibility with a reason (D-008)
- Appointment empty/error/success states

### 5. Manual end-to-end tests
Use `MANUAL_TEST_PLAN.md` and record actual results in `PROGRESS_LOG.md`.

## Quality gates per milestone
A milestone is accepted only when:
1. Its scope is complete.
2. Automated tests pass.
3. Typecheck/lint/build pass where applicable.
4. Manual scenarios are executed and recorded.
5. No unresolved critical or high-severity defect remains in the milestone.
6. Relevant documentation is updated.
7. A Git commit is created with a meaningful message.

## Suggested scripts (final names must match package.json)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Cline must inspect the actual package scripts before running them and must not claim a script exists before verifying.
