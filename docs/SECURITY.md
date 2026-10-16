# Security Baseline

## Authentication
- Hash passwords with bcrypt (or an approved alternative) using a suitable work factor.
- Use generic login failure messages to reduce account enumeration.
- JWT claims should be minimal: subject/user ID, issue/expiry times, and issuer/audience as appropriate.
- Keep signing secrets in environment variables and rotate them if exposed.
- Use an HttpOnly, Secure, SameSite=Strict cookie for the JWT (D-005). HttpOnly prevents JavaScript theft of the token.
- Clear the cookie on logout.

## Cookie security (local development vs production)
- **Local development (HTTP, same registrable host, different ports):** `localhost:3000` (frontend) and `localhost:8000` (API) are different origins because they use different ports, even though they share the same registrable host (`localhost`). The JWT cookie may omit the `Secure` flag so that localhost over plain HTTP functions. This is acceptable only in local development. `SameSite=Strict` and `HttpOnly` remain set. **M1 does not require CORS configuration** because the frontend shell makes no browser-side API calls; CORS will be configured in M3 when authenticated browser API calls are introduced.
- **Production (HTTPS):** The JWT cookie is always `Secure`; it is only transmitted over HTTPS. The cookie `Domain` and `SameSite` must match the production frontend/API origin relationship (see CSRF policy below).
- Cookie flags in production: `HttpOnly; Secure; SameSite=Strict`.

## CSRF policy (D-005)
SameSite=Strict is treated as a **mitigation, not the sole complete CSRF defense**. The strategy depends on deployment topology:

- **Same-site frontend and API (same registrable domain):** `SameSite=Strict` prevents the browser from sending the auth cookie on cross-site requests, providing strong CSRF protection. No additional CSRF token is required for this topology.
- **Cross-origin frontend and API (separate registrable domains):** `SameSite=Strict` would prevent the cookie from being sent on cross-site requests, which would break authentication. In this topology, either:
  - The frontend and API must share a parent domain and be treated as same-site, OR
  - A defense-in-depth CSRF token strategy is required (e.g., synchronizer token or double-submit cookie).

- **Server-side Origin/Referer validation (defense-in-depth):** State-changing requests (POST, PUT, DELETE, PATCH) must validate the `Origin` header (falling back to `Referer` if `Origin` is absent) against the expected frontend origin. Mismatches are rejected with HTTP 403. This protection applies regardless of SameSite configuration, but is especially important when SameSite alone is insufficient.
- **Open question (awaiting owner approval):** If the final deployment uses genuinely cross-origin frontend and API (separate registrable domains), a CSRF token strategy must be selected and documented. No library or infrastructure component is introduced without owner approval.

## Credentialed CORS
- The API must use a restrictive, explicit CORS allowlist — **never** a wildcard (`*`) when credentials are involved.
- When the frontend and API are on different origins, `Access-Control-Allow-Origin` must echo only approved frontend origin(s), and `credentials: include` must be enabled on the client.
- The expected frontend origin is configured via environment variable in both local development and production.
- CORS controls *which origins* may make credentialed requests; it does **not** replace CSRF protection. CSRF protection (SameSite + Origin validation) controls *whether* the browser sends the auth cookie on those requests.

## Authorization
- Derive user identity from validated auth middleware.
- Never accept a client-supplied user ID as authority.
- Filter all user-owned database queries by both resource ID and authenticated user ID.
- Test horizontal access attempts between two accounts.

## Request protection
- Validate body, params, and query inputs.
- Enforce JSON body-size limits.
- Rate-limit signup, login, chat, and booking confirmation.
- Add request timeouts for provider calls.
- Validate `Origin`/`Referer` on state-changing requests (POST, PUT, DELETE, PATCH) and reject mismatches with HTTP 403 (see CSRF policy above).
- Use safe HTTP headers and restrictive CORS allowlists.
- Do not use wildcard CORS with credentials (see Credentialed CORS above).

## AI-specific protection
- Treat model output as untrusted.
- Do not expose tools that let the model execute arbitrary business actions.
- Require explicit confirmation and revalidate all details server-side. AI output alone is never sufficient to create or confirm a booking (D-009).
- Prevent false confirmation: never mark a proposal as "Booked" in the UI before the server returns a persisted appointment record.
- Do not treat prompt instructions as security controls.
- Limit context and message size; never send credentials to the model.

## Logging and secrets
- Do not log passwords, cookies, authorization headers, API keys, or full sensitive payloads.
- Return generic errors to clients and retain safe request IDs for debugging.
- Keep `.env` out of version control; commit `.env.example` with placeholders only.
- Never include a real provider key in screenshots, test fixtures, commits, or README examples.

## Environment configuration
The API validates its environment at startup before binding to a port.

### `NODE_ENV` (required, M1)
- Must be explicitly provided at startup.
- Accepted values: `development`, `test`, `production`.
- Missing, empty, or unrecognized values cause validation to fail **before** the API begins listening.
- No implicit default to `development` is applied.
- If validation fails, the error message names the variable (`NODE_ENV`) but never reveals secret values or other environment variable contents.

### `PORT` (optional)
- When unset, the API defaults to `8000`.

### Feature-specific secrets (deferred enforcement)
The following environment variables are **not** enforced in M1. Each is required in production starting at the listed milestone, and the corresponding milestone enforces its own configuration validation:

| Variable | Milestone | Purpose |
|---|---|---|
| `DATABASE_URL` | M2 | PostgreSQL connection string (Prisma) |
| `JWT_SECRET` | M3 | JWT signing key (authentication) |
| `FRONTEND_URL` | M3 | CORS allowlist origin for browser API calls |
| `GROQ_API_KEY` | M6 | AI provider adapter |

**M1 acceptance limitation:** The API starts and serves `GET /health` without these secrets. An incompletely configured production deployment is **not** safe to use for any feature beyond the health endpoint. Secret enforcement is not removed — it is deferred to the milestones that need each secret.

## Security acceptance tests
- Unauthenticated access to private routes is rejected.
- User A cannot read or mutate User B's sessions, messages, or appointments.
- Invalid and expired tokens are rejected.
- Rate limits return 429 when exceeded.
- Malformed input is rejected before business logic runs.
- AI provider failure or hostile model output cannot create an appointment.
