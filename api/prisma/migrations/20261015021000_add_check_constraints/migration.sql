-- ──────────────────────────────────────────────────────────────────────────────
-- M2 Migration: Add CHECK constraints (reviewed custom SQL migration)
--
-- These constraints are not expressible in the Prisma migrate DSL and are
-- applied as reviewed custom SQL per docs/DATABASE_DESIGN.md (D-007).
--
-- Source: database/schema.sql (reference-only) and docs/DATABASE_DESIGN.md.
-- ──────────────────────────────────────────────────────────────────────────────

-- ChatMessage role check
ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_role_check"
    CHECK ("role" IN ('user', 'assistant'));

-- Appointment status check
ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_status_check"
    CHECK ("status" IN ('confirmed', 'cancelled', 'completed'));

-- Appointment ends_at must be after starts_at
ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_ends_after_starts"
    CHECK ("ends_at" > "starts_at");

-- BookingProposal status check
ALTER TABLE "booking_proposals"
    ADD CONSTRAINT "booking_proposals_status_check"
    CHECK ("status" IN ('pending', 'confirmed', 'expired', 'invalidated'));

-- BookingProposal ends_at must be after starts_at
ALTER TABLE "booking_proposals"
    ADD CONSTRAINT "booking_proposals_ends_after_starts"
    CHECK ("ends_at" > "starts_at");

-- BookingProposal duration must be exactly 30 minutes (D-008, D-009)
ALTER TABLE "booking_proposals"
    ADD CONSTRAINT "booking_proposals_duration_30min"
    CHECK ("ends_at" - "starts_at" = interval '30 minutes');
