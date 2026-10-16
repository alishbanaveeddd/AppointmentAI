# ADR-001: Initial Booking Scope and Scheduling Rules

**Status:** Accepted  
**Decision type:** Product scope and architecture  
**Date:** October 14, 2026

## Context

The application is a SaaS-style appointment-booking web application developed as part of a Senior Full Stack Developer assessment.

The system must demonstrate frontend engineering, backend API design, database modeling, authentication, AI integration, and maintainable software architecture.

The initial scope must be sufficiently complete to demonstrate end-to-end functionality without introducing unnecessary complexity that distracts from the assessment objectives.

## Decision 1: Single-Business Scope

The initial application will support one business.

### Rationale
- Reduces unnecessary tenant-management complexity.
- Allows us to focus on booking workflows, authentication, authorization, and data integrity.
- Makes the initial implementation easier to test and evaluate.

### Consequences
- Business-specific settings will still be modeled explicitly where appropriate.
- The initial application will not implement independent business accounts or tenant isolation.
- Multi-business support will require a separately reviewed architectural change.

## Decision 2: Single Shared Calendar

The initial application will use one shared booking calendar. Only one appointment may occupy a given time slot.

### Rationale
- Simplifies availability calculation and scheduling rules.
- Provides a clear opportunity to demonstrate server-side validation and database-level protection against conflicting bookings.
- Avoids introducing staff assignment and resource allocation before they are required.

### Consequences
- Concurrent bookings must not create overlapping appointments.
- This is enforced at the database level by a PostgreSQL exclusion constraint (D-006), applied as a reviewed custom SQL migration.
- Availability must be validated on the server, not trusted solely from the frontend.
- Staff-specific scheduling is outside the initial scope.

## Decision 3: Business-Configured Timezone

**Approved timezone (D-008):** `Asia/Karachi`.

The business will have a configurable timezone used for scheduling and displaying appointments.

### Rationale
- Appointment times should reflect the business's local operating hours.
- Customers may access the application from different timezones.
- Explicit timezone handling reduces ambiguity and scheduling errors.

### Implementation Rules
- Store appointment instants in UTC using a consistent database representation.
- Interpret business hours and generate appointment slots in the configured business timezone.
- Convert timestamps for presentation where necessary.
- Handle daylight-saving transitions using a timezone-aware implementation where applicable.
- Never rely on the customer's browser timezone as the authoritative business timezone.

## Review Conditions

Revisit these decisions if the product requirements introduce multiple businesses, staff-specific calendars, or resource-based scheduling.

Any change must include its motivation, impact on the data model, API contracts, validation rules, and tests.

## Approval

These decisions establish the initial implementation baseline. They may be changed only after reviewing the relevant requirements and trade-offs.

## Alignment with Owner-Approved Decisions

- **D-004 (Product scope):** Confirms the no-administrator, single-business scope below. Admin roles and configuration UIs are out of scope.
- **D-006 (Concurrency):** The shared-calendar overlap rule in Decision 2 is enforced by a PostgreSQL exclusion constraint as a reviewed custom SQL migration.
- **D-008 (Booking policy):** The business timezone is `Asia/Karachi` (Decision 3), Monday–Friday 9:00 AM–5:00 PM local, fixed 30-minute durations, no past bookings, and cancellation permitted until two hours before the appointment start.
- **D-009 (Confirmation):** AI output never creates a booking directly; explicit customer confirmation triggers backend revalidation before persistence.
