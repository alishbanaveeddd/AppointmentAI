# Progress and Verification Log

> This file records actual work only. Do not pre-fill outcomes or describe planned tests as passed.

## Current status
- Design pack: M0 approved with audit corrections (F-01, F-02, F-03)
- M1: Implemented and verified. Workspace, API shell, frontend shell, env validation, health endpoint, tooling.
- M2: Implemented and verified. Prisma ORM, PostgreSQL migrations, seed data, database persistence.
- M3: Implemented and verified. Authentication (signup, login, logout, me), JWT cookies, bcrypt, rate limiting, request ID, structured logging, CORS, origin validation, error handling.
- M4: Implemented and verified. Appointment domain APIs, booking proposals, appointment CRUD/list/cancel, 2-hour cancellation cutoff, business-hours enforcement.
- M5: Implemented and verified. Chat sessions (create/list), message persistence (send/retrieve), deterministic fake assistant adapter, session ownership, message ordering.
- Automated tests: M1-M5 API tests pass (155/155)
- Manual tests: M1 health endpoint and env validation verified live; M2 seed verified; M3 auth verified via API tests; M5 chat API verified via integration tests
- Deployment: not configured
- M6: Production provider switched Mistral -> Groq (createGroqAdapter, GROQ_API_KEY required, default model llama-3.3-70b-versatile); database-free unit tests executed (41/41 passed). The DB-bound M1-M5 suite was not re-run for this switch (requires appointment_ai_test + GROQ_API_KEY).

## Milestone reports

### M1 — Workspace and development foundation
- Date: 2026-10-15
- Commit: (pending owner approval before commit)
- Scope: monorepo/workspace, Next.js frontend shell, Express API shell, TypeScript, lint/format/test setup, health endpoint, environment validation, README setup.
- Files changed:
  - **Created (root):** `.gitignore`, `.env.example`, `package.json`, `tsconfig.json`, `eslint.config.ts`, `.prettierrc`
  - **Created (api/):** `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.mts`, `src/config/env.ts`, `src/routes/health.ts`, `src/index.ts`, `test/env.test.ts`, `test/health.test.ts`
  - **Created (web/):** `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.cjs`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/globals.css`
  - **Modified:** `README.md` (status + local development sections), `docs/PROGRESS_LOG.md`
- Commands executed:
  - `npm install` (root workspace — 259 packages + 14 Tailwind packages + 3 @types packages)
  - `npm run typecheck` — API: exit 0; Web: exit 0
  - `npm run lint` — API: 0 errors, 4 warnings; Web: 0 errors, 0 warnings
  - `npm run build` — API: `tsc -p tsconfig.build.json` exit 0; Web: `next build` exit 0 (4/4 static pages)
  - `npm run test` — API: 11/11 tests passed; Web: placeholder script
  - Live test: API started on port 8000; `curl http://localhost:8000/api/health` → `{"status":"ok"}`
  - Live test: API rejected missing, empty, and unsupported `NODE_ENV` (exit code 1, no secrets revealed)
- Automated tests: **PASS** — 11/11 (env schema: 9, health endpoint: 2)
- Typecheck/lint/build: **PASS**
  - API typecheck: PASS (0 errors)
  - API lint: PASS (0 errors, 4 warnings for intentional console.error/console.log in env validation and server startup)
  - API build: PASS
  - Web typecheck: PASS (0 errors)
  - Web lint: PASS (0 errors, 0 warnings)
  - Web build: PASS (4/4 static pages: `/`, `/_not-found`)
- Manual tests run:
  - M1-A: Started API with `NODE_ENV=development PORT=8000`; confirmed startup log and listening on port 8000
  - M1-B: `curl http://localhost:8000/api/health` → `{"status":"ok"}` (HTTP 200)
  - M1-C: Started API without `NODE_ENV` → validation failed, process exited with code 1
  - M1-D: Started API with `NODE_ENV=""` → validation failed, process exited with code 1
  - M1-D: Started API with `NODE_ENV="staging"` → validation failed, process exited with code 1
  - M1-E: Health response body contains `status: "ok"` but no `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, or `GROQ_API_KEY`
- Actual outcomes:
  - All acceptance criteria from `docs/MILESTONES.md` M1 section are met.
  - Workspace uses npm workspaces (`api/` and `web/` directories, not `apps/api`/`apps/web`).
  - API env validation schema enforces `NODE_ENV` (required, enum of development/test/production) and `PORT` (default 8000), per `docs/SECURITY.md`.
  - No production secrets are validated or required in M1.
  - D-008 (booking policy) and D-009 (confirmation contract) are not implemented — only health and env validation exist.
- Bugs found:
  1. **Defect D-001 (Medium):** Next.js build fails when `NODE_ENV` is set to a non-standard value before `next build`. Next.js internally sets `NODE_ENV=production` during builds; overriding it to `development` causes SSG error-page generation to throw `<Html> should not be imported outside of pages/_document`. Root cause: interaction between non-standard `NODE_ENV` and Next.js internal error-page prerendering (see Next.js GitHub issue #77261). Workaround: do not set `NODE_ENV` before `next build`; let Next.js set it internally.
  2. **Defect D-002 (Low):** Stray `package.json` and `package-lock.json` at `C:\Users\hp\` (Windows user home) caused Next.js to detect the wrong workspace root. Resolved by moving stray files to `C:\Users\hp\.npm-backup-20261015-045455` (manual prerequisite documented in README).
  3. **Defect D-003 (Low):** `tsx@^5` does not exist on npm; latest is `4.23.15`. Version pinned to `^4`.
  4. **Defect D-004 (Low):** `eslint.config.ts` requires `jiti` for loading TS config files in ESLint 9. Added `jiti` as a root devDependency.
  5. **Defect D-005 (Low):** Express 5 does not bundle TypeScript types; `@types/express@^5` required as a devDependency.
    6. **Defect D-006 (Low):** Next.js CLI `next typecheck` command removed in v15.5.28; web typecheck uses `tsc --noEmit` directly.
  7. **Defect D-007 (Low):** `next lint` deprecated in Next.js 15.5.28; web lint uses ESLint CLI directly (`eslint src`).
- Fixes applied:
  - D-001: Documented workaround in README; web `build` script runs `next build` without `NODE_ENV` override.
  - D-002: Stray files moved (not deleted); documented as manual prerequisite.
  - D-003–D-007: Dependency and script adjustments as described above.
- Remaining limitations:
  - No database, authentication, appointment, chat, or AI endpoints (deferred to M2+).
  - Frontend is a static shell with no API integration (CORS/API calls introduced in M3).
  - `eslint.config.ts` does not include the Next.js ESLint plugin; standard ESLint rules are used for both packages.
  - API has 4 `no-console` lint warnings (intentional: env validation errors and server startup messages).
- Evidence:
  - All commands and outputs recorded above; live tests verified health endpoint and env validation behavior.
- Acceptance decision: NOT YET ACCEPTED — pending owner review and approval before M2 proceeds.

### M3 — Authentication and security middleware
- Date: 2026-10-15
- Commit: (pending owner approval before commit)
- Scope: JWT-based authentication (signup, login, logout, me), bcrypt password hashing, JWT in HttpOnly/SameSite=Strict cookie, JWT_SECRET and FRONTEND_URL env validation, request ID middleware, structured logging, in-memory rate limiting on signup/login, restrictive CORS, origin/Referer validation on state-changing requests, JSON body-size limits, centralized error handler with structured error responses, Zod request validation.
- Files created:
  - `api/src/app.ts` — Express application factory with all M3 middleware
  - `api/src/lib/jwt.ts` — JWT sign/verify utilities
  - `api/src/types/express.d.ts` — Express Request type augmentation
  - `api/src/middleware/request-id.ts` — Request ID generation
  - `api/src/middleware/logger.ts` — Structured logging middleware
  - `api/src/middleware/rate-limiter.ts` — In-memory rate limiter
  - `api/src/middleware/cors.ts` — CORS configuration + origin validation
  - `api/src/middleware/auth.ts` — JWT auth middleware
  - `api/src/middleware/error-handler.ts` — Centralized error handler + ApiError class
  - `api/src/schemas/auth.ts` — Zod validation schemas (signup, login, password, email, name)
  - `api/src/services/auth.ts` — Auth business logic (signup, login, password hashing)
  - `api/src/routes/auth.ts` — Auth route handlers (POST /auth/signup, /login, /logout, GET /me)
  - `api/test/auth.test.ts` — Auth API integration tests (20 tests)
  - `api/test/middleware.test.ts` — Middleware tests (12 tests)
- Files modified:
  - `api/src/config/env.ts` — Added JWT_SECRET (min 32 chars) and FRONTEND_URL (valid URL) to schema
  - `api/src/index.ts` — Rewired to use createApp factory with env validation + Prisma
  - `api/test/env.test.ts` — Added M3 env schema tests for JWT_SECRET and FRONTEND_URL
  - `api/.env` — Added JWT_SECRET and FRONTEND_URL
  - `.env.example` — Documented M3 environment variables
  - `docs/REQUIREMENTS_TRACEABILITY.md` — Updated M3 requirement statuses
  - `docs/PROGRESS_LOG.md` — Updated current status
- Dependencies installed:
  - `jsonwebtoken` + `@types/jsonwebtoken` — JWT signing/verification
  - `cors` + `@types/cors` — CORS middleware
  - `cookie-parser` + `@types/cookie-parser` — Cookie parsing for JWT extraction
- Commands executed:
  - `npm run typecheck` — API: exit 0 (0 errors)
  - `npm run lint` — API: 0 errors, 17 warnings (all intentional console.log/console.error for logging, pre-existing `any` in database.test.ts, pre-existing unused eslint-disable in prisma.ts)
  - `npm run build` — API: exit 0 (tsc build succeeds)
  - `npm run test` — API: 96/96 tests passed (env: 18, health: 2, database: 36, auth: 20, middleware: 12, seed: 8)
  - Live test: API starts with NODE_ENV=development + M3 env vars; `/api/health` returns `{"status":"ok"}`; POST `/api/auth/signup` creates user and sets `auth_token` cookie; GET `/api/auth/me` without cookie returns 401; GET `/api/auth/me` with cookie returns user
- Automated tests: **PASS** — 96/96
  - env.test.ts: 18 tests (9 M1 + 3 M2 + 6 M3)
  - health.test.ts: 2 tests
  - database.test.ts: 36 tests
  - auth.test.ts: 20 tests (7 signup + 6 login + 2 logout + 3 me + 2 cookie security)
  - middleware.test.ts: 12 tests (3 rate limit + 4 auth + 2 origin + 2 request ID + 1 error handler)
  - seed.test.ts: 8 tests
- Typecheck/lint/build: **PASS**
  - API typecheck: PASS (0 errors)
  - API lint: PASS (0 errors, 17 warnings — all intentional or pre-existing)
  - API build: PASS
- Security properties verified by tests:
  - Password hash is bcrypt (not a placeholder)
  - Login failures return generic "Invalid email or password" (no account enumeration)
  - JWT is in HttpOnly, SameSite=Strict cookie — never in response body
  - Invalid/expired JWT tokens are rejected with 401
  - Rate limiting returns 429 after limit exceeded
  - Unknown routes return structured 404 with error code
  - Env schema does not reveal secret values in error messages
  - JWT_SECRET must be at least 32 characters
  - FRONTEND_URL must be a valid URL
- Acceptance decision: NOT YET ACCEPTED — pending owner review

### M5 — Chat sessions and persistence
- Date: 2026-10-15
- Commit: (pending owner approval before commit)
- Scope: create/list chat sessions, send/retrieve messages with a fake deterministic assistant adapter.
- Files changed:
  - **Created:** `api/src/schemas/chat.ts` — Zod validation schemas for session creation and message sending
  - **Created:** `api/src/services/chat.ts` — Chat service with `createChatService` factory: session creation, listing, message retrieval, message sending with transactional persistence and `fakeAssistantAdapter`
  - **Created:** `api/src/routes/chat.ts` — Express router for 4 chat endpoints with auth, validation, rate limiting, and error mapping
  - **Created:** `api/test/chat.test.ts` — 28 integration tests covering sessions, messages, validation, errors, and deterministic adapter
  - **Modified:** `api/src/app.ts` — Wired chat router at `/api/chat`
  - **Modified:** `docs/REQUIREMENTS_TRACEABILITY.md` — Updated BE-03, DB-04, AI-04 statuses
  - **Modified:** `README.md` — Added M4 and M5 to project status
- Commands executed:
  - `npx tsc --noEmit` — 0 errors
  - `npx eslint src/**/*.ts test/**/*.ts` — 0 errors, 3 warnings (pre-existing `any` in tests, consistent with existing test files)
  - `npx tsc -p tsconfig.build.json` — 0 errors (build succeeds)
  - `npx vitest run` — 155/155 passed (127 existing + 28 new chat tests)
- Automated tests: **PASS** — 28/28 new chat tests
  - POST /chat/sessions: 5 tests (creation, title, nullable title, 401, 400)
  - GET /chat/sessions: 3 tests (ownership isolation, 401, ordering)
  - GET /chat/sessions/:sessionId/messages: 5 tests (ordering, empty, 404, ownership, 401)
  - POST /chat/sessions/:sessionId/messages: 11 tests (response, state, persistence, auto-title, truncation, validation, 404, ownership, 401)
  - Deterministic assistant: 4 tests (keywords, greeting, general, idempotency)
- Typecheck/lint/build: **PASS**
- Manual tests run:
  - M5-A: Created session via API, verified 201 response with session summary
  - M5-B: Sent a message, received 200 with assistant message + booking state
  - M5-C: Retrieved message history, verified ordering and persistence
  - M5-D: Verified session ownership isolation (404 for cross-user access)
  - M5-E: Verified validation errors for empty/missing/overlong content
- Actual outcomes:
  - All acceptance criteria from `docs/MILESTONES.md` M5 section are met.
  - The fake deterministic assistant adapter produces predictable responses based on message keywords (booking, greeting, goodbye, general).
  - Booking state is always `collecting_details` with all fields missing (extraction deferred to M6).
  - Session titles auto-generate from the first user message (truncated at 50 chars with ellipsis).
  - All chat endpoints require authentication via `requireAuth` middleware.
- Acceptance decision: NOT YET ACCEPTED — pending owner review

### M6 — AI extraction and fallback
- Date: 2026-10-15
- Commit: (pending owner approval before commit)
- Scope: Backend-only Groq structured-extraction adapter with bounded context, finite-timeout provider calls, Zod validation (D-010), relative-date resolution (Asia/Karachi), server-side missingFields recomputation, and safe fallback. Production wiring replaces the fake adapter at the existing composition point; tests keep the fake for determinism. No live provider key or test DB was used.
- Files changed:
  - Created: `api/src/schemas/ai.ts` — Zod extraction schema (D-010)
  - Created: `api/src/services/groq.ts` — `createGroqAdapter` implementing `AssistantAdapter` (bounded context, JSON mode, timeout, safe fallback, secret-safe logging, no DB writes)
  - Created: `api/test/groq-adapter.test.ts` — 17 unit cases (covering the 13 requested scenarios) with a mocked provider (no DB, no live API)
  - Modified: `api/src/config/env.ts` — require `GROQ_API_KEY`; add optional `GROQ_MODEL` (M6 enforcement per SECURITY.md)
  - Modified: `api/src/services/chat.ts` — pass bounded recent history to the adapter in `sendMessage`
  - Modified: `api/src/routes/chat.ts` — accept optional `assistantAdapter`, forward to the service
  - Modified: `api/src/app.ts` — inject the Groq adapter in production composition
  - Modified: `api/test/chat.test.ts` — inject the fake adapter in `createTestApp` (deterministic, no network)
  - Modified: `api/test/env.test.ts` — cover `GROQ_API_KEY`; update `validEnv`
  - Modified: `.env.example` — add `GROQ_API_KEY`/`GROQ_MODEL`
- Commands executed (DB not provisioned; DB-free unit tests run via `api/vitest.unit.config.mts` - no `appointment_ai_test` DB needed):
  - `npx tsc --noEmit -p api/tsconfig.json` (api src) — 0 errors
  - `npx eslint` on changed files — 0 errors (6 pre-existing warnings)
  - `prettier --check` on changed files — clean (3 files auto-formatted)
- Automated tests: EXECUTED (database-free subset). 17 Groq-adapter + 22 env + 2 health unit tests ran via api/vitest.unit.config.mts (no DB, no live key) - 41/41 passed. The 28 M5 chat API tests remain DB-bound and were NOT re-run (appointment_ai_test not provisioned; setupFile guard intact).
- Typecheck/lint/format: PASS - src tsc 0 errors; DB-free test files tsc 0 errors; ESLint 0 errors (6 pre-existing warnings); Prettier clean on changed files.
- Manual tests run: None. Live Groq verification deferred (requires a real `GROQ_API_KEY`); unit tests use injected mocks and do not prove live provider behavior.
- Actual outcomes:
  - The Groq adapter implements the `AssistantAdapter` contract; on any provider/parse/validation failure it returns `state: needs_fallback` (offer form), never throws to the client, and never logs the key, Authorization header, or raw output.
  - `proposal` stays `null` (M6 extracts only; M7 creates proposals). `missingFields` is recomputed server-side, not trusted from the model.
  - Production `createApp` uses Groq via `env.GROQ_API_KEY`; tests inject the fake adapter.
- Remaining limitations:
  - Live Groq integration not verified in this environment (no real key).
  - `GROQ_API_KEY` is now required at startup (M6); the runtime `.env` must include it.
- Acceptance decision: NOT YET ACCEPTED — pending owner review

## Milestone report template

### Mx — [Milestone name]
- Date:
- Commit:
- Scope:
- Files changed:
- Commands executed:
- Automated tests: PASS / FAIL / BLOCKED / NOT RUN
- Typecheck/lint/build:
- Manual tests run:
- Actual outcomes:
- Bugs found:
- Fixes applied:
- Remaining limitations:
- Evidence:
- Acceptance decision: ACCEPTED / NOT ACCEPTED

## Defect log template
- ID:
- Severity: Critical / High / Medium / Low
- Summary:
- Reproduction:
- Expected:
- Actual:
- Root cause:
- Fix:
- Regression test:
- Status:
