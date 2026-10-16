# Technology Stack and Design Decisions

## Approved baseline

| Concern | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript | React ecosystem, routing, typed components |
| Styling | Tailwind CSS 4 | Consistent spacing and responsive layout quickly |
| Backend | Node.js v24 + Express 5 + TypeScript | Explicit REST API and middleware |
| Database | PostgreSQL | Relational integrity, transactions, indexes |
| ORM/migrations | Prisma | Typed persistence and repeatable schema migrations |
| AI provider | Groq API | Switched from Mistral per owner direction (D-012) |
| Validation | Zod 4 | Runtime validation for HTTP and AI output |
| Authentication | JWT in HttpOnly cookie | Browser-oriented auth without exposing token to JS |
| Password hashing | bcrypt | Standard password hashing library |
| Testing | Vitest 5 + Supertest 7 | Unit and API integration tests |
| Code quality | ESLint 9 (flat config) + Prettier 3 + TypeScript strict | Consistency and early error detection |

> **Version notes:** Owner-approved versions (D-005): Express 5, Zod 4, Next.js 15, React 19, Tailwind CSS 4. Owner-approved target versions; not yet installed or tested in this documentation-only task: Node.js v24, Vitest 5, Supertest 7, ESLint 9, Prettier 3. Tailwind CSS 4 uses `@import "tailwindcss"` in CSS and the `@tailwindcss/postcss` PostCSS plugin; no `tailwind.config.js` is needed. ESLint 9 requires flat config (`eslint.config.ts`); no `.eslintrc.*` files.

## Decision D-002 — Modular monolith
**Decision:** One Express API with modules rather than microservices.

**Why:** Small assessment scope, easier local setup, fewer deployment failures, simple debugging.

**Tradeoff:** Modules share a deployable process. Keep dependencies and interfaces explicit to avoid a monolith with tangled code.

## Decision D-003 — HTTP chat rather than WebSockets
**Decision:** Use POST requests for messages and return responses with a loading state.

**Why:** Meets near-real-time requirement and simplifies auth, testing, and hosting.

**Tradeoff:** No token-by-token streamed response. This can be considered after the core workflow is verified.

## Decision D-009 / D-010 — AI extraction rather than AI-controlled booking
> Maps to canonical decisions D-009 (confirmation contract) and D-010 (structured AI output validation) in `DECISION_LOG.md`.
**Decision:** AI returns structured candidate details; deterministic services enforce business rules and create bookings.

**Why:** Model output can be wrong or manipulated. Scheduling is a business operation that requires authoritative validation and explicit confirmation.

## Decision D-005 — JWT cookie for browser auth
**Decision:** Store JWT in an HttpOnly, Secure, SameSite=Strict cookie in deployed environments. SameSite is a mitigation, not the sole CSRF defense; the complete CSRF strategy (Origin validation, credentialed CORS, and open questions) is documented in `SECURITY.md` (CSRF policy and Cookie security sections).

**Why:** JavaScript cannot directly read an HttpOnly cookie; the Secure flag ensures the cookie is only transmitted over HTTPS in production.

**Tradeoff:** Cross-origin frontend/API deployment needs correct credentialed CORS configuration and cookie-domain/SameSite decisions (see `SECURITY.md`). Local development over HTTP uses relaxed cookie flags; production requires HTTPS. If the final deployment is genuinely cross-origin (separate registrable domains), a CSRF token strategy must be owner-approved — no new library is introduced without approval.

## Decision D-007 — Prisma migrations
**Decision:** Schema changes go through versioned migrations.

**Why:** Reproducible setup and clear schema history.

**Tradeoff:** Some PostgreSQL-specific exclusion constraints may need a hand-written SQL migration. Do not assume ORM-level checks alone prevent concurrent overlapping bookings.

## Change control
Any proposed stack, architecture, or requirement change must be written in `DECISION_LOG.md` with reason, alternatives, impact, and explicit approval before implementation.
