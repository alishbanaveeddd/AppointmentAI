# ⚠️ SUPERSEDED — Historical Draft

> **Status:** Superseded by owner decision **D-004** (customer-only scope).  
> **Date superseded:** October 14, 2026  
> **Superseding document:** `docs/PRODUCT_REQUIREMENTS.md` and `docs/DECISION_LOG.md` (D-004).
>
> This draft is preserved for historical context only. It defined an
> **Administrator** role and a business-configuration UI that are **out of
> scope** under the approved baseline (D-004). The current, authoritative
> product scope is **customer-only self-service** for a single business with
> server-side-defined business hours, timezone, and fixed appointment duration.
> Do not implement features described in this file that are not echoed by
> `docs/PRODUCT_REQUIREMENTS.md`.

---

# Appointment Booking Application — Product Requirements (historical)

**Status:** Superseded (historical draft)  
**Date:** October 14, 2026

## 1. Purpose

Build a full-stack web application that allows customers to book and manage appointments online. Business administrators can manage scheduling settings and appointments. An AI booking assistant helps customers find suitable times through natural-language conversation.

The application must demonstrate frontend engineering, backend API design, database modeling, authentication and authorization, AI integration, testing, and maintainable architecture.

## 2. Target Users

### Customer
A registered user who can:
- Sign up and log in.
- View available appointment slots.
- Book an appointment.
- View their own appointments.
- Cancel eligible appointments.

### Administrator
An authorized user who can:
- Log in to the administrative interface.
- Configure business hours and timezone.
- Configure the initial service duration.
- View and manage appointments.

## 3. Initial Scope

- One business.
- One shared booking calendar.
- One initial service.
- A configurable service duration, initially 30 minutes.
- Configurable business hours, initially Monday–Friday, 9 AM–5 PM.
- A configurable business timezone.
- Customer and administrator roles.
- Appointment creation, viewing, and cancellation.
- A conversational AI booking assistant that requires customer confirmation.

## 4. Booking Rules

- Appointments must fit within business hours.
- Appointments must not overlap.
- The backend must validate availability when creating a booking.
- Customers may only manage their own appointments.
- The proposed cancellation cutoff is two hours before the appointment.
- Appointment timestamps must be handled consistently across timezones.
- A booking is confirmed only after successful backend validation and database persistence.

## 5. AI Safety Rules

- AI may interpret natural-language requests.
- AI may help retrieve and explain available appointment options.
- AI must not invent availability.
- AI must not bypass authentication or authorization.
- AI must not directly write to the database.
- The customer must explicitly confirm the appointment before creation.
- The backend remains responsible for validation and booking creation.
- AI must not claim success unless the backend confirms it.

## 6. Out of Scope Initially

- Multiple businesses.
- Multiple staff calendars.
- Online payments.
- Automatic SMS notifications.
- Autonomous AI cancellation or rescheduling.

Any expansion must be reviewed and documented before implementation.

## 7. Quality Expectations

The application should have:
- Secure authentication and server-side authorization.
- Reliable prevention of conflicting bookings.
- Clear validation and error messages.
- Automated tests for important business rules.
- Maintainable code and documented API contracts.
- Reproducible local setup instructions.
- Documented configuration and deployment steps.

## 8. Change Control

Requirements must not be changed silently. Significant changes must document the reason, alternatives, consequences, and affected tests before implementation.