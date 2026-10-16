# Decision Log

Use this file to record accepted decisions and material changes. A proposed change is not approved until explicitly accepted by the project owner.

## D-001 — Initial stack
- **Status:** Superseded by D-005 (owner-approved)
- **Decision:** Next.js + TypeScript, Express + TypeScript, PostgreSQL, Prisma, Groq API, Zod, JWT cookie, bcrypt, Tailwind, Vitest/Supertest.
- **Reason:** Matches the assessment and supports clear frontend/backend separation.
- **Alternatives:** Plain React/Vite; another LLM provider; raw SQL instead of Prisma.
- **Impact:** Two app surfaces and one relational database; deployment requires CORS/cookie configuration.
- **Note:** Re-approved in detail as D-005. The stack remains as originally decided.

## D-002 — Modular monolith
- **Status:** Approved (consistent with owner-approved baseline D-005)
- **Decision:** One Express API organized by modules.
- **Reason:** Keeps service boundaries clear without microservice overhead.

## D-003 — HTTP chat
- **Status:** Approved (consistent with owner-approved baseline D-005)
- **Decision:** Request/response chat with persistent history and loading states.
- **Reason:** Meets near-real-time requirement while reducing implementation risk.

## D-004 — Product scope (customer-only)
- **Status:** Approved by owner; documentation pending review
- **Decision:** Customer-only self-service for one business. No admin dashboard or admin role. Business hours, timezone, and appointment duration are predefined through server-side configuration.
- **Reason:** Reduces scope complexity; keeps the prototype focused on the authenticated customer booking workflow described in the README core user journey.
- **Alternatives considered:** Administrator role with a configuration UI (rejected — would expand scope beyond the assessment core flow).
- **Tradeoffs and risks:** Business settings are server-side configured, so no runtime admin UI is supported in the prototype. The previously separate `docs/decisions/01-product-requirements.md` draft (which defined an Administrator role) is superseded by this decision; see its superseded banner.
- **Files/docs affected:** `PRODUCT_REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `UI_UX_SPEC.md`, `docs/decisions/01-product-requirements.md`.
- **Approved by / date:** Owner; October 14, 2026.

## D-005 — Technology stack
- **Status:** Approved by owner; documentation pending review
- **Decision:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Node.js v24, Express 5, PostgreSQL, Prisma, Groq through a backend-only adapter, Zod 4, JWT in an HttpOnly cookie, bcrypt, Vitest 5, Supertest 7, ESLint 9 (flat config), Prettier 3, and strict TypeScript.
- **Reason:** Matches the assessment requirements and supports clear frontend/backend separation.
- **Alternatives considered:** Plain React/Vite; another LLM provider; raw SQL instead of Prisma.
- **Tradeoffs and risks:** Cross-origin frontend/API deployment needs correct credentialed CORS configuration and cookie-domain/SameSite decisions. Local development settings differ from production.
- **Files/docs affected:** `README.md`, `TECH_STACK_AND_DECISIONS.md`, `CLINE_INSTRUCTIONS.md`.
- **Approved by / date:** Owner; October 14, 2026.

## D-006 — Concurrency and overlap prevention
- **Status:** Approved by owner; documentation pending review
- **Decision:** Use a PostgreSQL exclusion constraint to prevent overlapping active (confirmed) appointments, combined with backend revalidation and a structured HTTP 409 conflict response on confirmation.
- **Reason:** A simple starts_at/ends_at check-then-insert is not safe under concurrent requests. A database-level exclusion constraint is the authoritative guard.
- **Alternatives considered:** Application-level advisory locks; `SELECT FOR UPDATE` within a transaction. Both add complexity and still require the exclusion constraint as the definitive guard.
- **Tradeoffs and risks:** The exclusion constraint requires the `btree_gist` PostgreSQL extension and a PostgreSQL-specific custom SQL migration (not part of the base Prisma migration). Only `confirmed` appointments participate in the constraint; `cancelled` and `completed` appointments are excluded via a partial index filter.
- **Files/docs affected:** `DATABASE_DESIGN.md`, `database/schema.sql`, `API_CONTRACT.md`, `ARCHITECTURE.md`.
- **Approved by / date:** Owner; October 14, 2026.

## D-007 — Database authority
- **Status:** Approved by owner; documentation pending review
- **Decision:** `prisma/schema.prisma` and Prisma migrations are the authoritative schema. PostgreSQL-specific features (notably the exclusion constraint for overlap prevention per D-006) may use reviewed custom SQL migrations. `database/schema.sql` is reference-only/illustrative and must not be treated as the implementation artifact.
- **Reason:** Provides typed, repeatable migrations while permitting the PostgreSQL-specific exclusion constraint.
- **Alternatives considered:** Pure raw-SQL migrations without Prisma.
- **Tradeoffs and risks:** The raw `database/schema.sql` must not be treated as the implementation artifact. Traceability references that list `database/schema.sql` as authoritative must be corrected to reference `prisma/schema.prisma`.
- **Files/docs affected:** `DATABASE_DESIGN.md`, `REQUIREMENTS_TRACEABILITY.md`, `database/schema.sql`.
- **Approved by / date:** Owner; October 14, 2026.

## D-008 — Booking policy
- **Status:** Approved by owner; documentation pending review
- **Decision:** Business timezone is `Asia/Karachi`; business hours Monday–Friday, 9:00 AM–5:00 PM (local); fixed 30-minute appointment durations; no bookings in the past; cancellation permitted until two hours before the appointment start time; availability restricted to business hours and without overlapping active appointments.
- **Reason:** Provides concrete, testable scheduling rules without requiring a real calendar integration or an admin configuration UI.
- **Alternatives considered:** Admin-configured business hours (rejected per D-004 scope simplification).
- **Tradeoffs and risks:** Hardcoding these values means they are not runtime-configurable in the prototype. All policy rules must be enforced server-side; the booking service owns the source of truth for business hours.
- **Files/docs affected:** `PRODUCT_REQUIREMENTS.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `ARCHITECTURE.md`, `AI_WORKFLOW.md`.
- **Approved by / date:** Owner; October 14, 2026.

## D-009 — Confirmation contract
- **Status:** Approved by owner; documentation pending review
- **Decision:** Every booking proposal has a unique ID. Stale proposals expire or are invalidated when booking details change or the proposal is no longer valid. The backend revalidates authorization, booking rules, and availability on every confirmation. Repeated confirmation requests are idempotent and cannot create duplicate appointments. Explicit customer confirmation is required; AI output alone must never create a booking.
- **Reason:** Prevents false confirmations, race conditions, and AI-driven unauthorized writes.
- **Alternatives considered:** Stateless confirmation without a proposal record (rejected — cannot support idempotency or expiry guarantees).
- **Tradeoffs and risks:** Requires a `booking_proposals` tracking mechanism (table or cache with TTL) to support idempotency and expiry. The proposal is not persisted as an appointment until explicit confirmation succeeds.
- **Files/docs affected:** `API_CONTRACT.md`, `AI_WORKFLOW.md`, `DATABASE_DESIGN.md`, `ARCHITECTURE.md`, `TEST_STRATEGY.md`.
- **Approved by / date:** Owner; October 14, 2026.

## D-010 — Structured AI output validation
- **Status:** Approved by owner; documentation pending review
- **Decision:** The backend validates every AI response against a Zod schema. Missing or invalid structured output triggers a deterministic fallback (clarification prompt or form), never a speculative booking.
- **Reason:** Untrusted model output must never reach business logic or persistence paths.
- **Alternatives considered:** Using raw model text in a form field (rejected — too easy to misuse for false confirmations).
- **Tradeoffs and risks:** Adds a schema-parsing dependency. Must handle provider format drift without crashing.
- **Files/docs affected:** `AI_WORKFLOW.md`, `API_CONTRACT.md`, `TEST_STRATEGY.md`.
- **Approved by / date:** Owner; October 14, 2026.

## D-011 — No admin UI
- **Status:** Approved by owner; documentation pending review
- **Decision:** No administrator role, admin dashboard, or business-rule configuration UI is exposed in the prototype. Business hours, timezone, and appointment duration are server-side configured only (see D-004 scope).
- **Reason:** Keeps the prototype focused on the authenticated customer booking workflow.
- **Alternatives considered:** Administrator role with a configuration UI (rejected — out of scope per D-004).
- **Tradeoffs and risks:** Business settings are not runtime-configurable and cannot be changed without a code/deployment change.
- **Files/docs affected:** `PRODUCT_REQUIREMENTS.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `MILESTONES.md`, `DEMO_AND_SUBMISSION.md`.
- **Approved by / date:** Owner; October 14, 2026.
## Alignment with documentation (D-001–D-011)
| Decision | Title | Where aligned |
|---|---|---|
| D-001 | Initial stack | Superseded by D-005; retained for history |
| D-002 | Modular monolith | `TECH_STACK_AND_DECISIONS.md`, `ARCHITECTURE.md` |
| D-003 | HTTP chat | `AI_WORKFLOW.md`, `ARCHITECTURE.md` |
| D-004 | Product scope (customer-only) | `PRODUCT_REQUIREMENTS.md`, `UI_UX_SPEC.md` |
| D-005 | Technology stack | `README.md`, `TECH_STACK_AND_DECISIONS.md`, `CLINE_INSTRUCTIONS.md` |
| D-006 | Concurrency and overlap prevention | `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `ARCHITECTURE.md` |
| D-007 | Database authority | `DATABASE_DESIGN.md`, `README.md`, `REQUIREMENTS_TRACEABILITY.md` |
| D-008 | Booking policy | `PRODUCT_REQUIREMENTS.md`, `DATABASE_DESIGN.md`, `ARCHITECTURE.md` |
| D-009 | Confirmation contract | `API_CONTRACT.md`, `AI_WORKFLOW.md`, `DATABASE_DESIGN.md` |
| D-010 | Structured AI output validation | `AI_WORKFLOW.md`, `API_CONTRACT.md`, `TEST_STRATEGY.md` |
| D-011 | No admin UI | `PRODUCT_REQUIREMENTS.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` |


## D-012 - AI provider selection (Groq)
- **Status:** Approved by owner (M6 follow-up, owner-directed)
- **Decision:** Use Groq as the backend-only AI extraction provider. Endpoint `https://api.groq.com/openai/v1/chat/completions`, auth `Authorization: Bearer $GROQ_API_KEY`, JSON output via `response_format: { type: "json_object" }`. Default/extraction model `llama-3.3-70b-versatile` (current Groq Production model; `gemma2-9b-it` was not in the current supported-models list, so it was not used). Environment: `GROQ_API_KEY` (required at startup) and optional `GROQ_MODEL`.
- **Reason:** Owner directed the switch from the originally specified Mistral provider to Groq for the M6 extraction adapter.
- **Alternatives considered:** Retain Mistral (rejected - owner direction).
- **Files/docs affected:** `api/src/services/groq.ts`, `api/src/config/env.ts`, `api/src/app.ts`, `api/.env.example`, `docs/SECURITY.md`, `docs/TECH_STACK_AND_DECISIONS.md`, `docs/AI_WORKFLOW.md`, `docs/ARCHITECTURE.md`.
## Change template
- **Status:** Proposed / Approved / Rejected / Superseded by D-XXX
- **Context:**
- **Decision:**
- **Alternatives considered:**
- **Tradeoffs and risks:**
- **Files/docs affected:**
- **Approved by / date:**
