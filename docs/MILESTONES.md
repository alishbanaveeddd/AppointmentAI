# Implementation Milestones

> Implement sequentially. Do not start the next milestone until the current one has evidence, a recorded outcome, and acceptance.

## M0 — Design baseline and repository plan
**Scope:** review this documentation pack, resolve open decisions, establish repo and change-control rules. No application implementation.

**Deliverables:** approved requirements, architecture, schema plan, API contract, UI spec, security and test plans.

**Acceptance:** every required assessment area is mapped to a requirement and milestone; assumptions and out-of-scope features are explicit; all decision records D-001–D-011 are aligned across the documentation pack.

## M1 — Workspace and development foundation
**Scope:** monorepo/workspace, Next.js frontend shell, Express API shell, TypeScript, lint/format/test setup, health endpoint, environment validation, README setup.

**Tests:** health route; env schema rejects missing/empty/unsupported `NODE_ENV` and accepts supported values (`development`, `test`, `production`); health endpoint returns 200 with structured body; typecheck/lint/build.

**Limitation:** Production-secret enforcement (`DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, `FRONTEND_URL`) is deferred to M2/M3/M6. M1 does not require a database, JWT secret, or AI provider key to start the API and serve `/health`. The env schema enforces `NODE_ENV` only — see `docs/SECURITY.md`, "Environment configuration." Secret enforcement is not removed; it is deferred to the milestones that need each secret.

**Manual:** install dependencies from clean checkout; run frontend and API; open UI; call health endpoint.

## M2 — PostgreSQL and persistence
**Scope:** Prisma configuration, initial migration, models, test database setup, exclusion constraint migration (D-006), booking_proposals table (D-009), seed script.

**Tests:** migration from empty DB; CRUD smoke tests; foreign key and uniqueness constraints; exclusion constraint prevents overlapping confirmed appointments; booking_proposals expiry/idempotency; seed repeatability or safe reset behavior.

**Manual:** run migration and seed using documented commands; inspect rows in PostgreSQL; verify exclusion constraint and booking_proposals table exist.

## M3 — Authentication and security middleware
**Scope:** signup/login/logout/me, password hashing, cookie/JWT handling, auth middleware, validation, request ID, logging, rate limits.

**Tests:** valid/invalid credentials, duplicate email, missing/expired token, logout, ownership principal, rate limiting.

**Manual:** register, log in, refresh, log out, verify protected route behavior. Inspect browser cookie flags.

## M4 — Appointment domain and APIs
**Scope:** booking service, appointment CRUD/list/cancel, allowed statuses/durations, timezone policy (Asia/Karachi, Mon–Fri 9–5, 30-min slots, D-008), conflict prevention (D-006 exclusion constraint), booking proposal lifecycle (D-009), 2-hour cancellation cutoff (D-008).

**Tests:** valid creation, invalid time range, unauthorized ownership, cancellation before/after 2-hour cutoff, slot conflict, concurrent conflict test, proposal idempotency, business-hours rejection.

**Manual:** create and cancel appointments through UI/API; verify database state and timezone display.

**Gate:** do not proceed with AI booking until direct appointment APIs are reliable.

## M5 — Chat sessions and persistence
**Scope:** create/list sessions, send/retrieve messages with a fake deterministic assistant adapter initially.

**Tests:** session ownership, message ordering, persistence after refresh, validation, error states.

**Manual:** send messages, refresh, reopen history, try another user's session ID.

## M6 — AI extraction and fallback
**Scope:** Groq adapter, structured extraction schema, timeout handling, bounded context, safe logging, fallback to form/clarification.

**Tests:** mocked valid output, malformed output, missing fields, provider timeout, provider 429/5xx, prompt-injection-like content.

**Manual:** test natural language, ambiguous request, incomplete request, and provider-unavailable fallback. Live API test is optional and must not be the only test.

## M7 — Conversational booking and confirmation
**Scope:** server-owned conversation state, proposal card, explicit confirmation endpoint, revalidation, transaction-safe booking creation.

**Tests:** no booking before confirmation; yes without pending proposal does not book; edited details invalidate old proposal; proposal expiry handled; repeated confirmation does not create duplicates; conflict at confirmation handled.

**Manual:** complete a full chat-to-booking journey and verify the saved appointment.

## M8 — Frontend integration and UX polish
**Scope:** connect auth, dashboard, chat, forms, appointment list/cancellation; responsive layout and accessible interaction states.

**Tests:** core component behavior and API error/loading states.

**Manual:** desktop/mobile pass; keyboard navigation; refresh persistence; failed network request recovery.

## M9 — End-to-end regression and documentation
**Scope:** execute all acceptance scenarios, fix defects, update architecture/API/README, record known limitations.

**Tests:** complete automated suite, typecheck, lint, production build.

**Manual:** run all of `MANUAL_TEST_PLAN.md` against a clean environment.

## M10 — Deployment and submission
**Scope:** deploy frontend/API/PostgreSQL, configure secrets/CORS/cookies, verify live workflow, publish repository and docs, record demo.

**Tests:** smoke tests against live URLs; verify no secrets in Git history/current files; final build and regression.

**Manual:** new account → chat → proposal → confirmation → appointment list → cancellation; test a second account and error path; verify no business/admin UI is accessible (D-011).

## Time management
The deadline is 72 hours. If behind schedule, prioritize M1–M8 core flow and M10 deployment. Do not sacrifice auth, booking integrity, or actual verification to add optional features.
