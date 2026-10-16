-- ──────────────────────────────────────────────────────────────────────────────
-- M2 Migration: Booking overlap exclusion constraint (D-006)
--
-- Per docs/DATABASE_DESIGN.md (D-006): This is a reviewed custom SQL migration
-- because Prisma's migrate DSL cannot express exclusion constraints.
--
-- The constraint prevents overlapping confirmed appointments on the shared
-- booking calendar. Only 'confirmed' rows participate; 'cancelled' and
-- 'completed' are excluded.
--
-- Half-open range: tstzrange(starts_at, ends_at) produces [start, end), so
-- adjacent appointments may touch but not overlap.
-- ──────────────────────────────────────────────────────────────────────────────

-- Requires the btree_gist extension for GiST indexing on range and scalar types.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevents overlapping confirmed appointments on the shared calendar.
-- Only 'confirmed' rows participate; 'cancelled' and 'completed' are excluded.
ALTER TABLE "appointments"
    ADD CONSTRAINT "no_overlapping_confirmed_appointments"
    EXCLUDE USING GIST (tstzrange("starts_at", "ends_at") WITH &&)
    WHERE ("status" = 'confirmed');
