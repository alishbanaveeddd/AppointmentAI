# Requirements Traceability Matrix

This document is the source of truth for ensuring that no assessment requirement is accidentally omitted. Every requirement must map to design, implementation, automated verification, manual verification, and evidence.

**Status vocabulary**
- `DESIGNED`: documented; not yet implemented.
- `IMPLEMENTED`: code exists but verification may be incomplete.
- `VERIFIED`: implementation and required tests/manual checks have passed with evidence.
- `BLOCKED`: progress is blocked; reason and next action are recorded.
- `NOT APPLICABLE`: permitted only with a written rationale and owner approval.

Never mark a requirement `VERIFIED` merely because a UI element exists or an AI agent says it works.

**Evidence:** For `DESIGNED` requirements, the design reference columns above serve as the current evidence. For `IMPLEMENTED`/`VERIFIED`, concrete evidence (test artifacts, run logs, manual-check records) is captured in `docs/PROGRESS_LOG.md` at verification time. This is a documentation-only pass; no requirement advances beyond `DESIGNED` here.

## A. Frontend requirements

| ID | Assessment requirement | Design reference | Planned milestone | Automated verification | Manual verification | Status |
|---|---|---|---|---|---|---|
| FE-01 | React or Next.js frontend | `ARCHITECTURE.md`, `TECH_STACK_AND_DECISIONS.md` | M1, M8 | Typecheck/build; component tests | Open app locally and on deployment | DESIGNED |
| FE-02 | Embedded chatbot UI | `UI_UX_SPEC.md`, `AI_WORKFLOW.md` | M5, M8 | Chat component tests | Send message and receive response | DESIGNED |
| FE-03 | Real-time or near-real-time chat | `ARCHITECTURE.md` | M5, M8 | API response/state tests | Check loading, latency feel, errors, retries | DESIGNED |
| FE-04 | Signup/login UI | `UI_UX_SPEC.md` | M3, M8 | Form and API integration tests | Register, login, logout | DESIGNED |
| FE-05 | JWT authentication (HttpOnly cookie) | `SECURITY.md`, `API_CONTRACT.md` | M3 | Auth middleware and cookie tests | Refresh session; verify logout | DESIGNED |
| FE-06 | Appointment booking UI | `UI_UX_SPEC.md` | M4, M7, M8 | Form validation and booking state tests | Form booking and conversational booking | DESIGNED |
| FE-07 | Clean, usable, responsive interface | `UI_UX_SPEC.md` | M8 | Component tests; build | Desktop/mobile and keyboard review | DESIGNED |
| FE-08 | Component structure/state management | `ARCHITECTURE.md` | M1, M8 | Typecheck and component tests | Review loading/error/empty states | DESIGNED |
| FE-09 | Async flows and errors | `UI_UX_SPEC.md`, `API_CONTRACT.md` | M3–M8 | Timeout/error tests | Disconnect API or trigger validation errors | DESIGNED |
| FE-10 | Display proposal ID for review | `UI_UX_SPEC.md`, `API_CONTRACT.md` | M4, M7 | Booking state tests | Review proposal before confirm | DESIGNED |
| FE-11 | Display cancellation eligibility (2-hour rule) | `UI_UX_SPEC.md`, `PRODUCT_REQUIREMENTS.md` | M4, M8 | Cancel eligibility tests | Cancelling too late is blocked | DESIGNED |

## B. Backend requirements

| ID | Assessment requirement | Design reference | Planned milestone | Automated verification | Manual verification | Status |
|---|---|---|---|---|---|---|
| BE-01 | Node.js + Express or equivalent | `TECH_STACK_AND_DECISIONS.md` | M1 | Build/typecheck | Start API locally | DESIGNED |
| BE-02 | Authentication REST APIs | `API_CONTRACT.md` | M3 | Signup/login/logout/me tests | Run full auth flow | VERIFIED |
| BE-03 | Chat message REST APIs | `API_CONTRACT.md` | M5 | API integration tests | Send and retrieve messages | VERIFIED |
| BE-04 | Appointment proposal and confirmation APIs | `API_CONTRACT.md` | M4 | API integration tests | Create proposal, confirm, retrieve booking | DESIGNED |
| BE-05 | JWT authentication (HttpOnly cookie) | `SECURITY.md` | M3 | Missing/invalid/expired auth tests | Attempt private route without auth | VERIFIED |
| BE-06 | Request validation middleware | `SECURITY.md`, `API_CONTRACT.md` | M1, M3–M7 | Invalid body/params tests; env schema tests (rejects missing/empty/invalid `NODE_ENV`, applies `PORT` default of `8000`) | Submit malformed values; omit `NODE_ENV` at startup | DESIGNED |
| BE-07 | Request logging | `SECURITY.md`, `ARCHITECTURE.md` | M1 | Logger/request ID tests | Inspect sanitized logs | VERIFIED |
| BE-08 | Basic rate limiting | `SECURITY.md` | M3 | Exceed configured limit in tests | Repeat login/chat requests | VERIFIED |
| BE-09 | Proper error handling/status codes | `API_CONTRACT.md` | M1–M10 | Assert status and error schema | Trigger expected errors incl. 409 | DESIGNED |
| BE-10 | Clear service boundaries | `ARCHITECTURE.md` | M1–M10 | Unit tests at service boundary | Review route/service separation | DESIGNED |
| BE-11 | PostgreSQL exclusion constraint + 409 conflict | `DATABASE_DESIGN.md`, `API_CONTRACT.md` | M2, M4 | Exclusion/concurrency tests | Concurrent booking fails gracefully | DESIGNED |
| BE-12 | Booking proposal endpoints + idempotency | `API_CONTRACT.md`, `DATABASE_DESIGN.md` | M4 | Proposal/confirm idempotency tests | Confirm twice; cancel one | DESIGNED |

## C. AI requirements

| ID | Assessment requirement | Design reference | Planned milestone | Automated verification | Manual verification | Status |
|---|---|---|---|---|---|---|
| AI-01 | Integrate an AI provider API | `AI_WORKFLOW.md` | M6 | Adapter tests; optional live smoke test | Valid provider request | DESIGNED |
| AI-02 | Understand appointment requests | `AI_WORKFLOW.md` | M6 | Intent fixture tests | Natural-language requests | DESIGNED |
| AI-03 | Extract booking details | `AI_WORKFLOW.md` | M6 | Structured-output tests | Date/time/service examples | DESIGNED |
| AI-04 | Multi-turn conversation memory | `AI_WORKFLOW.md`, `DATABASE_DESIGN.md` | M5–M7 | Context/state tests | Follow-up messages and refresh | IMPLEMENTED |
| AI-05 | Fallback for incomplete/ambiguous input | `AI_WORKFLOW.md`, `UI_UX_SPEC.md` | M6, M8 | Missing-field and invalid-output tests | Incomplete/ambiguous requests | DESIGNED |
| AI-06 | Log AI interactions for debugging/analytics | `AI_WORKFLOW.md` | M6 | Safe telemetry tests | Inspect redacted event/log output | DESIGNED |
| AI-07 | Handle provider failures | `AI_WORKFLOW.md` | M6 | Timeout/429/5xx/malformed output tests | Disable provider key or simulate failure | DESIGNED |
| AI-08 | Keep AI separate from business logic | `ARCHITECTURE.md` | M4, M6, M7 | Unit tests prove service owns writes | Review code; try hostile input | DESIGNED |
| AI-09 | Avoid false booking confirmation | `AI_WORKFLOW.md` | M7 | No-write-before-confirmation tests | Stop at proposal; inspect DB | DESIGNED |
| AI-10 | Proposal ID and confirmation contract | `AI_WORKFLOW.md`, `API_CONTRACT.md` | M6, M7 | Structured-output and idempotency tests | Verify proposalId, confirm twice | DESIGNED |

## D. Database requirements

| ID | Assessment requirement | Design reference | Planned milestone | Automated verification | Manual verification | Status |
|---|---|---|---|---|---|---|
| DB-01 | PostgreSQL | `DATABASE_DESIGN.md` | M2 | Connection/migration tests | Inspect database connection | DESIGNED |
| DB-02 | `users` table | `DATABASE_DESIGN.md`, `prisma/schema.prisma` | M2 | Migration/constraint tests | Inspect schema | DESIGNED |
| DB-03 | `appointments` table | `DATABASE_DESIGN.md`, `prisma/schema.prisma` | M2, M4 | Constraints/transaction tests | Inspect persisted appointment | DESIGNED |
| DB-04 | `chat_sessions` table | `DATABASE_DESIGN.md`, `prisma/schema.prisma` | M2, M5 | CRUD/ownership tests | Inspect session rows | VERIFIED |
| DB-05 | Sample inserts/seed statements | `DATABASE_DESIGN.md` | M2 | Seed execution test | Run seed and inspect records | DESIGNED |
| DB-06 | Indexing strategy | `DATABASE_DESIGN.md` | M2 | Migration/schema checks | Review index definitions | DESIGNED |
| DB-07 | Performance considerations | `DATABASE_DESIGN.md` | M2, M9 | Bounded query/context tests | Review query and payload behavior | DESIGNED |
| DB-08 | Optional multi-tenancy | `DATABASE_DESIGN.md` | Deferred unless time remains | Tenant isolation tests if implemented | Cross-tenant isolation test | DESIGNED / OPTIONAL |
| DB-09 | Booking proposals table | `DATABASE_DESIGN.md`, `prisma/schema.prisma` | M4 | Proposal constraint/idempotency tests | Inspect proposal rows | DESIGNED |

## E. Documentation and submission requirements

| ID | Assessment requirement | Design reference | Planned milestone | Verification | Status |
|---|---|---|---|---|---|
| DOC-01 | High-level architecture | `ARCHITECTURE.md` | M0, M9 | Review against code | DESIGNED |
| DOC-02 | Local setup instructions | `README.md` | M1, M9 | Follow from clean checkout | DESIGNED |
| DOC-03 | Design decisions/tradeoffs | `TECH_STACK_AND_DECISIONS.md`, `DECISION_LOG.md` | M0–M10 | Review for implemented reality | DESIGNED |
| DOC-04 | Assumptions/known limitations | `PRODUCT_REQUIREMENTS.md`, `README.md` | M0, M9 | Review and update | DESIGNED |
| DOC-05 | GitHub repository | `DEMO_AND_SUBMISSION.md` | M10 | Open repository URL | DESIGNED |
| DOC-06 | Publicly viewable README/docs | `DEMO_AND_SUBMISSION.md` | M10 | Open without reviewer-specific access | DESIGNED |
| DOC-07 | Deployed live prototype | `DEMO_AND_SUBMISSION.md` | M10 | Live smoke test | DESIGNED |
| DOC-08 | Optional demo video | `DEMO_AND_SUBMISSION.md` | M10 | Play final recording | DESIGNED |

## Release gate
Before submission, every mandatory ID must be `VERIFIED`, or explicitly listed as a known limitation with a clear explanation and an informed decision to accept it. Optional requirements may remain unimplemented only if the owner agrees. Never hide a failed or untested requirement.
