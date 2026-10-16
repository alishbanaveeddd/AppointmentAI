# API Contract

Base prefix: `/api`. JSON request and response bodies unless otherwise specified. All endpoints except signup/login/health require authentication.

## Authentication
Uses a JWT stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The JWT is never returned in JSON.
- `POST /auth/signup` — `{ name, email, password }` → `201` user summary; sets the JWT cookie.
- `POST /auth/login` — `{ email, password }` → `200` user summary; sets the JWT cookie.
- `POST /auth/logout` — clears the JWT cookie → `204`.
- `GET /auth/me` — current user summary → `200`.

Do not return password hashes or JWT values in JSON.

## Chat
- `POST /chat/sessions` — create session → `201` session summary.
- `GET /chat/sessions` — list current user's sessions → `200`.
- `GET /chat/sessions/:sessionId/messages` — ordered message history → `200`.
- `POST /chat/sessions/:sessionId/messages` — `{ content }` → `200` assistant response and next action/state.

Example response shape (collecting details):
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "What type of consultation would you like?"
  },
  "booking": {
    "state": "collecting_details",
    "missingFields": ["service", "requested_date", "requested_time"],
    "proposal": null
  }
}
```

When all fields are present and valid, the `booking` object returns a proposal with a unique ID:
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "I found a slot. Please confirm to book."
  },
  "booking": {
    "state": "awaiting_confirmation",
    "missingFields": [],
    "proposal": {
      "proposalId": "uuid",
      "service": "consultation",
      "startsAt": "2026-10-20T10:00:00+05:00",
      "endsAt": "2026-10-20T10:30:00+05:00",
      "timezone": "Asia/Karachi",
      "expiresAt": "2026-10-20T09:45:00+05:00"
    }
  }
}
```

The booking object is illustrative; define a TypeScript response schema and keep it consistent.

## Appointments

### Proposals
- `POST /appointments/proposals` — create a booking proposal from validated AI output → `201`. Returns `proposalId`, proposed details, expiry, and any `missingFields`.
- `GET /appointments/proposals/:proposalId` — retrieve a pending proposal → `200`; or `409` if the proposal has expired or been invalidated (D-009).

### Confirmation
- `POST /appointments/proposals/:proposalId/confirm` — explicit customer confirmation. The backend revalidates authorization, booking rules (D-008: business hours, duration, timezone), and availability (D-006) before persisting → `201`. Idempotent: repeated confirmation of the same valid proposal returns the same appointment and never creates a duplicate (D-009).
- HTTP `409 Conflict` is returned for overlapping slots, stale proposals, or expired proposals.
- AI output alone never reaches the confirmation endpoint; explicit confirmation is mandatory (D-009).

### Appointment management
- `GET /appointments` — current user's appointments → `200`.
- `GET /appointments/:appointmentId` — owned appointment → `200`.
- `PATCH /appointments/:appointmentId/cancel` — cancel an eligible appointment. Eligible means the appointment is confirmed and at least two hours remain before the start time (D-008) → `200`.

The UI may gather details conversationally or through a form. Both paths must call the same backend booking service.

## Health
- `GET /health` — liveness only; do not expose secrets or internal configuration.

## Error response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields.",
    "requestId": "request-id"
  }
}
```

## Status conventions
- `200`: successful read/update/action
- `201`: resource created
- `204`: successful logout with no body
- `400`: malformed request or schema validation failure
- `401`: missing/invalid authentication
- `403`: authenticated but disallowed action, if revealing existence is acceptable
- `404`: missing resource or resource not owned by caller, according to the chosen policy
- `409`: appointment slot conflict, stale proposal, or expired proposal (structured conflict body returned)
- `429`: rate limit exceeded
- `500`: unexpected server error

## Conflict response (D-006, D-009)
Returned as `409` for overlapping active appointments, stale proposals, or expired proposals:
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "The selected time slot is no longer available.",
    "requestId": "request-id",
    "conflict": {
      "type": "slot_unavailable | stale_proposal | proposal_expired",
      "proposalId": "uuid-or-null"
    }
  }
}
```

## API rules
- Validate request bodies, params, and query strings.
- Never trust `userId` supplied by the client; derive it from the authenticated principal.
- Apply ownership filters in the database query itself.
- Add request IDs and safe structured logs.
- Document pagination if lists can grow; don't return unbounded history in production.
