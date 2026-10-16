# Demo and Submission Checklist

## Repository
- [ ] Code pushed to GitHub.
- [ ] Repository access is correct for reviewers.
- [ ] README is readable without signing in where required.
- [ ] No secrets or `.env` files committed.
- [ ] Commit history is understandable.
- [ ] License/privacy choices are appropriate for the submission.

## Live demo
- [ ] Frontend URL works.
- [ ] API health URL works without exposing internals.
- [ ] Database migrations are applied.
- [ ] Signup/login/logout work.
- [ ] Chat persists after refresh.
- [ ] AI extraction works or the documented fallback is available.
- [ ] Proposal requires explicit confirmation.
- [ ] Proposal ID is displayed for review (D-009).
- [ ] Appointment is persisted and visible in the list.
- [ ] Cancellation works.
- [ ] Cancellation is blocked when fewer than 2 hours remain (D-008).
- [ ] Cross-user access is denied.
- [ ] No admin/business-rule UI is reachable (D-011).
- [ ] Mobile layout and error states are checked.
- [ ] Secrets and CORS/cookie settings are configured for deployment.

## Demo video outline (2–4 minutes)
1. Introduce the problem and architecture briefly.
2. Register/login.
3. Ask for an appointment conversationally.
4. Demonstrate clarification or form fallback.
5. Review and confirm the proposal.
6. Show the persisted appointment.
7. Show chat history after refresh and cancellation.
8. Briefly show tests and documentation.

## Review discussion topics
- Why a modular monolith instead of microservices?
- Why use an LLM for extraction but not execution?
- How are overlapping bookings prevented?
- How does the system prevent false booking confirmation?
- How is session ownership enforced?
- How are AI failures and malformed output handled?
- What is deliberately out of scope?
- What would change for multiple businesses, staff calendars, and higher load?
- Which tests provide confidence and which risks remain?
