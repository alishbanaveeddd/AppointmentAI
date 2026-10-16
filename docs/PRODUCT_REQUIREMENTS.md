# Product Requirements

## 1. Problem statement
People should be able to request an appointment conversationally without needing to understand a complex scheduling form. The application must clarify missing information and provide a reliable, explicit confirmation step.

## 2. Target prototype
A single-business appointment-booking application with authenticated users. Multi-tenancy is intentionally out of scope for the initial assessment prototype unless time remains after all core acceptance criteria pass. This is a **customer-only self-service** application: no administrator role, admin dashboard, or business-configuration UI is in scope (D-004).

## 3. Functional requirements

### Authentication
- FR-001: A visitor can register with name, email, and password.
- FR-002: The API stores a password hash, never a plaintext password.
- FR-003: A registered user can log in and log out.
- FR-004: A user can retrieve their own profile.
- FR-005: Protected resources require valid authentication.

### Chat
- FR-006: An authenticated user can create a chat session.
- FR-007: A user can send a message and receive an assistant response.
- FR-008: User and assistant messages persist and appear after refresh.
- FR-009: A user can retrieve only their own sessions and messages.
- FR-010: The UI provides loading, error, retry, and empty states.

### AI understanding
- FR-011: The AI service classifies the message intent and extracts candidate booking details.
- FR-012: The API validates the AI output against a schema.
- FR-013: The assistant asks for missing or ambiguous required details.
- FR-014: The application offers a structured form fallback.
- FR-015: The model cannot directly create, confirm, or cancel an appointment.

### Appointments
- FR-016: A user can review the proposed service, date, time, and duration.
- FR-017: Appointment creation requires explicit user confirmation.
- FR-018: The backend validates dates, duration, business hours, and availability against the defined policy (Asia/Karachi, Mon–Fri 9:00–17:00, 30-minute duration, no past bookings) per D-008.
- FR-019: The backend prevents conflicting bookings for the configured scheduling resource using a PostgreSQL exclusion constraint plus backend revalidation (D-006).
- FR-020: A user can list and retrieve their own appointments.
- FR-021: A user can cancel an eligible appointment. An appointment is eligible if it is confirmed and at least two hours remain before the appointment start time (D-008). Cancellation returns the cancellation identifier.
- FR-022: A successful booking is persisted and returns a confirmation identifier. Booking follows a two-step proposal-then-confirm flow: the backend issues a unique proposal ID with a defined expiry; explicit confirmation revalidates all rules and is idempotent — repeated confirmation requests for the same valid proposal cannot create duplicate appointments (D-009).

### Booking proposals
- FR-023: A booking proposal carries a unique proposal ID and a defined expiry (TTL). The backend invalidates a proposal when booking details change or the proposal is no longer valid (D-009).
- FR-024: The backend revalidates authorization, booking rules, and availability on every confirmation request (D-009).

### Operational requirements
- FR-025: The API validates requests, logs request metadata, and applies rate limits.
- FR-026: The system returns consistent error responses and suitable HTTP status codes, including HTTP 409 Conflict on overlapping or stale proposals (D-006, D-009).
- FR-027: AI provider failure does not create a false booking confirmation; proposals expire and explicit confirmation is always required (D-009).
- FR-028: The README explains setup, architecture, decisions, tradeoffs, assumptions, and limitations.

## 4. Non-functional requirements
- NFR-001: TypeScript strict mode is enabled where supported.
- NFR-002: Business logic is separated from HTTP route handlers.
- NFR-003: API keys and secrets are not present in source control or browser bundles.
- NFR-004: User-owned resources are protected by server-side ownership checks.
- NFR-005: Booking conflict handling is safe under concurrent requests via a PostgreSQL exclusion constraint plus backend revalidation and a structured 409 Conflict response (D-006).
- NFR-006: Core workflow tests run locally with documented commands.
- NFR-007: UI is responsive and has accessible labels, keyboard operation, and visible focus states.
- NFR-008: Errors are actionable without exposing secrets, stack traces, or sensitive data.
- NFR-009: Appointment instants are stored in UTC; all scheduling logic uses the business timezone `Asia/Karachi` (D-008).
- NFR-010: Every milestone has recorded automated and manual verification outcomes.

## 5. Assumptions
- The prototype represents one business and a single scheduling resource.
- The assessment does not require payments, email/SMS reminders, calendar-provider integration, staff management, or recurring appointments.
- Chat uses ordinary HTTP request/response with a near-real-time loading state. WebSockets are not required to prove the core workflow.
- Appointment duration is a fixed 30 minutes (D-008).
- Users must confirm a booking before it is created (D-009).
- Available hours are Monday–Friday, 9:00 AM–5:00 PM in the business timezone `Asia/Karachi` (D-008). No bookings in the past; cancellation is permitted until two hours before the appointment start time.
- Business hours, timezone, and appointment duration are server-side configured and are not exposed to an admin UI (D-004, D-008).

## 6. Out of scope
- Production-grade multi-tenant billing and subscription management
- External calendar synchronization
- Payments and refunds
- Voice calls, streaming speech, and agent frameworks
- Complex staff rosters and resource optimization
- Enterprise SSO and advanced compliance certifications
- Administrator role, admin dashboard, or business configuration UI (D-004 — explicitly out of scope)

## 7. Definition of done
A requirement is done only when its code exists, relevant automated tests pass, manual checks are recorded, known limitations are documented, and the implementation is reviewed. A green build alone does not prove the full user workflow works.
