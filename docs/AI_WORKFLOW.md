# AI Workflow and Guardrails

## Purpose
Use the LLM to interpret natural-language requests and extract candidate booking fields. Do not use it as the source of truth for authorization, availability, appointment status, or database writes.

## Suggested output schema
```json
{
  "intent": "book_appointment | ask_question | cancel_appointment | unknown",
  "service": "string or null",
  "requested_date": "YYYY-MM-DD or null",
  "requested_time": "HH:mm or null",
  "duration_minutes": "number or null",
  "missingFields": ["service", "requested_date", "requested_time"],
  "clarification_question": "string or null"
}
```
> **Canonical property naming convention:** All JSON/API-facing properties use **camelCase**, including `missingFields`, `proposalId`, `requestedDate`, etc. (D-004 documentation alignment.)
Use an actual Zod discriminated schema in implementation. The example is a design contract, not an instruction to trust arbitrary model output.

## Workflow
1. Persist the user message.
2. Build a bounded context from recent messages and server-owned booking state.
3. Call Groq from the backend with a timeout and output-format instructions.
4. Parse and validate the returned object.
5. Reject invalid fields; never allow model output to overwrite user identity or permissions.
6. Resolve relative dates using a configured business timezone and the current clock.
7. Ask for missing fields or present a structured form.
8. Present a booking proposal with a unique backend-assigned `proposalId`, exact service, date, time, timezone, and duration. The proposal has a defined expiry (TTL).
9. Require explicit confirmation from the user. AI output alone never triggers a write.
10. On confirmation, the booking service revalidates authorization, booking rules, and availability; only then is the appointment persisted. The backend revalidation is the authoritative check.
11. Persist assistant response and safe provider metadata.

## Conversation state
Keep a small server-side state machine, for example:
- `collecting_details`
- `awaiting_confirmation`
- `booked`
- `cancelled`
- `needs_fallback`

State transitions must be validated by backend code. The model can suggest intent but cannot force a state transition.

## Fallback behavior
- Missing/ambiguous fields → ask one focused question or return form fields.
- AI provider unavailable → show a friendly message and offer manual form.
- Invalid structured output → log a safe error code and fall back.
- User says “yes” without a pending proposal → do not create a booking.
- User changes date/time after confirmation → invalidate the old confirmation and show a new proposal.
- Stale proposal after TTL expiry → backend returns a stale-proposal response; a new proposal must be generated (D-009).

## Prompt injection and privacy
- Treat user messages as untrusted data.
- System instructions do not replace deterministic checks.
- Send only the bounded conversation context needed for extraction.
- Do not send secrets, password hashes, auth cookies, or unrelated profile data.
- Never put the provider API key in frontend code.
- Avoid logging full raw conversations by default; log request ID, provider/model, latency, outcome, and safe failure metadata.

## Observability
Capture AI call duration, provider success/failure, schema-validation result, fallback count, and token usage if exposed by the provider. Avoid storing unnecessary personal data.

## Booking proposal and confirmation contract (D-009)
The AI layer only **proposes** a booking. The booking service owns the authoritative proposal lifecycle:
1. A validated AI result triggers `POST /appointments/proposals`, which returns a unique `proposalId` with a defined expiry (TTL).
2. The front end shows the proposal and waits for **explicit** customer confirmation.
3. `POST /appointments/proposals/:proposalId/confirm` revalidates authorization, booking rules (D-008), and availability; on success it creates the appointment and marks the proposal as `confirmed`.
4. Repeated confirmation of the same valid proposal is idempotent (returns the same appointment, never a duplicate).
5. Proposals are invalidated when details change or when they expire. Stale/expired proposals receive a structured conflict response (HTTP 409).
6. **AI output alone never creates or confirms a booking.**
