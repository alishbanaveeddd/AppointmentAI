# Cline Project Instructions — Appointment AI

Read `README.md` and all relevant files in `docs/` before implementation.

## Mandatory workflow

1. Work only on the currently approved milestone in `docs/MILESTONES.md`.
2. Before editing, summarize the intended changes and files.
3. Do not silently change technologies, architecture, requirements, API contracts, or schema decisions. Propose a decision-log entry and wait for approval.
4. Do not claim a test passed unless you actually ran it and can report the command and result.
5. Never mark a milestone accepted by yourself. Provide evidence and a concise report for owner review.
6. Keep secrets out of source control. Never print full environment secrets.
7. Prefer small, reviewable changes and deterministic tests.
8. If a dependency or manual prerequisite is needed, explain why and give exact Windows PowerShell steps. Do not install global tools or download executables without asking first.
9. If blocked, stop and report the exact blocker rather than inventing a workaround that changes the stack.
10. Update `docs/PROGRESS_LOG.md`, relevant design docs, and tests at the end of each milestone.

## Required milestone report

- Summary of changes
- Files created/modified
- Commands run
- Automated test results
- Typecheck/lint/build results
- Manual verification steps for the owner
- Expected and actual outcomes
- Known limitations/defects
- Suggested commit message
- Whether acceptance criteria are met (with evidence)

## Engineering constraints

- Frontend: Next.js 15 / React 19 + TypeScript.
- Backend: Node.js v24 + Express 5 + TypeScript.
- Database: PostgreSQL.
- AI provider: Groq through a backend-only adapter.
- Validate external input with Zod 4.
- TypeScript strict mode; flat-config ESLint 9 (no `.eslintrc`); Prettier 3.
- Keep routes/controllers thin and business logic in services.
- AI output is untrusted; AI cannot directly write to the database or authorize bookings.
- Enforce resource ownership server-side.
- Appointment confirmation must revalidate availability and be concurrency-safe.
- Use Prisma migrations (approved per D-005). PostgreSQL-specific features use reviewed custom SQL migrations (see D-006).

## Requirement completeness (mandatory)

- Before each milestone, read `docs/REQUIREMENTS_TRACEABILITY.md` and identify the IDs in scope.
- Do not delete, downgrade, mock, or silently defer any mandatory assessment requirement.
- If you believe a requirement cannot be implemented within the deadline, explain the blocker and propose options for owner approval; do not make that decision yourself.
- Keep traceability statuses honest: DESIGNED is not IMPLEMENTED; IMPLEMENTED is not VERIFIED.
- At each milestone end, update traceability only for requirements actually implemented and verified, and link the relevant test/report evidence in `docs/PROGRESS_LOG.md`.
- Before final submission, audit every mandatory row in the traceability matrix against code, tests, manual results, and live deployment.
