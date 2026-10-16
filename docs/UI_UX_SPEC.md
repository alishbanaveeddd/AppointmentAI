# UI / UX Specification

## Visual direction
A polished, calm, professional SaaS interface. Use a light neutral canvas, restrained accent color, clear typography, consistent spacing, readable cards, and visible keyboard focus. Avoid visual clutter and excessive gradients.

## Screen 1 — Authentication
- Signup and login forms with labels and inline validation.
- Password visibility toggle if practical.
- Loading state during submission.
- Useful error message for invalid credentials or duplicate email.
- No secrets or tokens shown in the UI.

## Screen 2 — Dashboard
- Navigation: Overview, AI Assistant, Appointments, Account/Logout.
- Welcome heading and primary “Book an appointment” action.
- Upcoming appointment summary and status.
- Empty state for users with no appointments.
- Responsive sidebar/navigation on smaller screens.

## Screen 3 — Chat
- Clear distinction between user and assistant messages.
- Message composer with disabled/loading behavior while sending.
- Enter-to-send behavior that remains accessible; Shift+Enter for newline if multiline.
- Persistent chat history after refresh.
- Typing/loading indicator and retry affordance.
- Error state that does not erase the user's draft.
- Booking proposal rendered as a structured card, not buried in prose.

## Screen 4 — Booking proposal / fallback form
- Service, date, time, timezone, and duration shown explicitly.
- Show the unique `proposalId` for user reference (D-009).
- Clear “Confirm booking” and “Edit details” actions.
- Missing required values visibly identified.
- Confirmation is disabled until required fields are valid.
- A proposal must not be labelled “Booked” before the server confirms persistence.
- No admin or business-rule configuration UI is exposed (D-011).

## Screen 5 — Appointments
- List upcoming/past appointments with status.
- Show date and time in business timezone (Asia/Karachi) (D-008).
- Cancel action only when permitted: only if confirmed and at least two hours remain before the start time (D-008).
- Cancel button disabled/hidden when not eligible, with a short reason shown.
- Confirmation before cancellation.
- Loading, empty, error, and success states.

## Interaction and accessibility
- Use semantic HTML and form labels.
- Keyboard accessible controls and visible focus.
- Maintain contrast and do not communicate status using color alone.
- Avoid layout shifts during loading.
- Provide responsive layouts at mobile, tablet, and desktop widths.
- Disable duplicate submits while requests are in flight; still enforce idempotency/conflict handling on the server.

## UI acceptance checklist
- A new user can find signup and complete it without instructions.
- A returning user can log in and log out.
- The user can tell what the AI knows and what still needs confirmation.
- The booking proposal clearly shows a unique proposal ID for reference (D-009).
- The booking confirmation clearly distinguishes proposed vs persisted appointments.
- Cancellation is correctly disabled when fewer than two hours remain or the appointment is not confirmed (D-008).
- API errors are readable and recoverable.
- The main flow works at a narrow mobile width as well as desktop.
