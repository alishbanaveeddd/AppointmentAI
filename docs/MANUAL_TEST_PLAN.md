# Manual Test Plan

## Instructions
Run only after the relevant milestone is implemented. Record date, environment, build/commit, tester, actual outcome, and evidence in `PROGRESS_LOG.md`. Use synthetic demo data only.

Status values: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`.

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| MT-001 | Register | Submit valid name/email/password | Account created; no plaintext password stored |
| MT-002 | Duplicate registration | Register same email again | Clear error; no duplicate account |
| MT-003 | Login | Log in with valid credentials | Dashboard loads; authenticated state persists as designed |
| MT-004 | Invalid login | Use wrong password | Generic authentication error |
| MT-005 | Logout | Log out and call protected API | Session cleared; API returns 401 |
| MT-006 | Protected route | Open private page without auth | Redirect or appropriate unauthorized UI |
| MT-007 | Create chat | Start a new session and send message | Session and messages persist |
| MT-008 | Refresh history | Refresh and reopen session | Previous messages load in order |
| MT-009 | Missing details | Ask to book “sometime tomorrow” | Assistant asks a focused question or form appears |
| MT-010 | Ambiguous date/time | Use unclear date/time | No appointment created until resolved |
| MT-011 | AI outage | Disable/invalid provider key in test environment | Friendly fallback; no false success |
| MT-012 | Proposal | Supply all required fields | Exact proposal appears with timezone, unique proposal ID, and confirmation action (D-009) |
| MT-013 | Confirm booking | Confirm a valid proposal | One appointment is persisted and shown as booked |
| MT-014 | No pending proposal | Send “yes” without a proposal | No appointment created |
| MT-015 | Slot conflict | Request a conflicting slot | Clear conflict; no overlapping appointment created |
| MT-016 | Double submit | Click confirm repeatedly | No duplicate booking |
| MT-017 | Appointment list | Open appointments screen | Only current user's appointments shown |
| MT-018 | Cancel appointment | Cancel an eligible appointment | Status changes; UI refreshes |
| MT-025 | Cancel too late | Attempt cancellation < 2 hours before start | Cancel action disabled/hidden; clear reason shown (D-008) |
| MT-026 | Business hours | Request an appointment outside Mon–Fri 9–5 | No proposal offered; guidance shown (D-008) |
| MT-027 | No admin UI | Look for admin/settings pages | No business-rule or admin UI is reachable (D-011) |
| MT-019 | Cross-user access | Use another account's resource ID | No data is leaked or changed |
| MT-020 | Mobile layout | Test narrow viewport | Controls remain usable; no horizontal overflow |
| MT-021 | Keyboard access | Navigate forms/chat using keyboard | Focus is visible and actions are operable |
| MT-022 | API error | Simulate network/server error | Error is visible; draft is not unexpectedly lost |
| MT-023 | Deployment smoke test | Run full core workflow on live deployment | Workflow works with production configuration |
| MT-024 | Secret scan | Inspect tracked files and Git diff | No API keys, passwords, or `.env` committed |

## Result template
For every failed test record:
- Test ID:
- Environment / commit:
- Expected:
- Actual:
- Reproduction steps:
- Severity:
- Evidence (sanitized screenshot/log):
- Issue/fix:
- Retest outcome:
