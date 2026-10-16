# Architecture

## 1. Architecture style
Use a modular monolith for the API and a separately deployed Next.js frontend. This provides clear boundaries without distributed-system overhead.

## 2. Logical architecture

```text
Browser
  |
  | HTTPS / JSON REST / secure JWT cookie (HttpOnly, Secure, SameSite=Strict)
  v
Next.js frontend
  |-- Auth screens
  |-- Dashboard and appointment list
  |-- Chat and booking confirmation UI
  |
  v
Express API
  |-- Middleware: request ID, logging, rate limits, validation, auth
  |-- Auth module
  |-- Chat module
  |-- Appointment module
  |-- AI service boundary
  |-- Booking/business rules
  |-- Persistence layer (Prisma)
  |
  +------> PostgreSQL
  |
  +------> Groq API (server-side only)
```

## 3. Module responsibilities
- **Frontend:** renders UI, manages local interaction state, calls API, displays server outcomes. It is not the authority for permissions or availability.
- **Routes/controllers:** HTTP parsing, status codes, response shape, and passing validated input to services.
- **Services:** business operations, authorization-aware workflows, and orchestration.
- **AI service:** provider request, bounded context construction, output parsing, schema validation, timeout/error mapping. No database writes.
- **Booking service:** date/time validation, availability policy, explicit confirmation, transaction-safe creation, cancellation rules.
- **Persistence layer:** Prisma queries and transaction boundaries.
- **PostgreSQL:** durable state, constraints, uniqueness, and conflict protection where applicable.

## 4. Core booking sequence
1. Browser posts a chat message to an authenticated session endpoint.
2. API verifies session ownership and stores the user message.
3. Chat service retrieves a bounded amount of relevant history.
4. AI service extracts intent and candidate fields. **(No DB writes.)**
5. API validates the AI result and merges it into server-owned conversation state.
6. If information is missing, return a clarification prompt or form fields.
7. When all fields are present, booking service evaluates business rules (D-008: hours, duration, timezone, no past bookings) and creates a `BookingProposal` with a unique `proposalId` and TTL. Returns the proposal for explicit confirmation.
8. On a separate confirmation request, booking service revalidates every field, business rules (D-008), and availability (D-006 exclusion constraint) before persisting.
9. Persist the appointment within a transaction; the PostgreSQL exclusion constraint is the concurrency-safe backstop. Repeated confirmation is idempotent (D-009).
10. Store assistant response and return the authoritative appointment record.

## 5. Data flow and trust boundaries
- Browser input is untrusted.
- AI output is untrusted even if it is valid JSON.
- Authorization, ownership, availability, allowed duration, and booking status are enforced by backend code.
- Provider credentials remain in API environment variables.
- Logs should record request ID, timings, status, and safe error codes, not passwords, tokens, or unnecessary raw chat content.

## 6. Real-time decision
Use HTTP request/response with a loading indicator and persistent chat history. The requirement permits near-real-time chat. WebSockets add lifecycle, reconnection, and deployment complexity without being necessary for the core use case.

## 7. Failure behavior
- AI timeout/provider failure: return a recoverable message and offer the structured form.
- Invalid model output: reject it, log a safe diagnostic, and fall back.
- Database failure: return a generic server error with request ID; do not claim success.
- Slot conflict: return HTTP 409 and ask the user to choose another slot.
- Expired/invalid auth: return HTTP 401.
- Unauthorized ownership: use a consistent 404 or 403 policy to avoid leaking resource existence.

## 8. Scalability considerations
For the prototype, one API service and PostgreSQL are sufficient. Keep service boundaries clean so later work could add provider adapters, calendar integrations, business/tenant scope, background notifications, or streaming without prematurely introducing microservices.
