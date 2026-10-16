-- ============================================================================
--  APPOINTMENT AI — POSTGRESQL DDL SCHEMA REFERENCE
-- ----------------------------------------------------------------------------
--  Assessment Deliverable: Database Design (users, appointments, chat_sessions)
--  Authoritative Prisma Schema: prisma/schema.prisma
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- 1. Users Table (Authentication & Profile Data)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Chat Sessions Table (Conversational History & Metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Chat Messages Table (Multi-turn Turn-by-Turn History)
-- ----------------------------------------------------------------------------
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Appointments Table (Scheduling Data & Lifecycle Status)
-- ----------------------------------------------------------------------------
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);

-- Concurrency Conflict Prevention: Exclusion Constraint (D-006)
-- Prevents overlapping confirmed appointments on the shared calendar at DB level.
ALTER TABLE appointments
    ADD CONSTRAINT no_overlapping_confirmed_appointments
    EXCLUDE USING GIST (tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status = 'confirmed');

-- ----------------------------------------------------------------------------
-- 5. Booking Proposals Table (Explicit Transient Confirmation Lifecycle, D-009)
-- ----------------------------------------------------------------------------
CREATE TABLE booking_proposals (
    proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'expired', 'invalidated')),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at),
    CHECK (ends_at - starts_at = interval '30 minutes')
);

-- ============================================================================
-- INDEXING STRATEGY
-- ============================================================================
-- Unique index on email for O(1) user authentication lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Composite index for chronological session retrieval per user
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
    ON chat_sessions(user_id, updated_at DESC);

-- Composite index for ordered message history retrieval per session
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
    ON chat_messages(session_id, created_at ASC);

-- Index for user schedule queries and upcoming appointment sorting
CREATE INDEX IF NOT EXISTS idx_appointments_user_start
    ON appointments(user_id, starts_at DESC);

-- Index for proposal TTL checks, active proposal retrieval, and cleanup
CREATE INDEX IF NOT EXISTS idx_booking_proposals_user_expires_status
    ON booking_proposals(user_id, expires_at, status);

-- ============================================================================
-- SAMPLE INSERT STATEMENTS (Deterministic Seed Data)
-- ============================================================================
-- 1. Sample User (password: Demo@12345, bcrypt hashed)
INSERT INTO users (id, name, email, password_hash, created_at)
VALUES (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'Demo User',
    'demo@example.com',
    '$2a$12$e8x5QJ2c2hB0c5zZq8/vO.E0eF3nK5rL2mO7pT1wY3uI6oP9aBcDe', -- Bcrypt hash of Demo@12345
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- 2. Sample Chat Session
INSERT INTO chat_sessions (id, user_id, title, metadata, created_at, updated_at)
VALUES (
    'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'General Consultation Scheduling',
    '{"provider": "groq", "model": "llama-3.3-70b-versatile"}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Sample Chat Messages
INSERT INTO chat_messages (id, session_id, role, content, created_at)
VALUES
    (gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'user', 'Hi, I need a consultation next Monday at 10:00 AM.', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'assistant', 'I can help with that! Here is your proposal for Monday at 10:00 AM Asia/Karachi.', NOW() - INTERVAL '1 day' + INTERVAL '3 seconds'),
    (gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'user', 'Yes, confirm please.', NOW() - INTERVAL '1 day' + INTERVAL '20 seconds'),
    (gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'assistant', 'Your General Consultation appointment is confirmed for Monday at 10:00 AM.', NOW() - INTERVAL '1 day' + INTERVAL '22 seconds');

-- 4. Sample Confirmed Appointments
INSERT INTO appointments (id, user_id, service, starts_at, ends_at, status, created_at)
VALUES
    (
        'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        'General Consultation',
        '2026-10-19 10:00:00+05',
        '2026-10-19 10:30:00+05',
        'confirmed',
        NOW() - INTERVAL '1 day'
    ),
    (
        gen_random_uuid(),
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        'Follow-up Consultation',
        '2026-10-21 14:00:00+05',
        '2026-10-21 14:30:00+05',
        'completed',
        NOW() - INTERVAL '2 days'
    );

-- ============================================================================
-- PERFORMANCE CONSIDERATIONS & SCALABILITY NOTES
-- ============================================================================
-- 1. Concurrency Safety:
--    The exclusion constraint (btree_gist) operates at the transaction serialization
--    level, eliminating race conditions under concurrent requests without needing
--    heavy application-level distributed locks.
--
-- 2. Message History Bounded Pagination:
--    Chat messages are retrieved using the composite index (session_id, created_at ASC),
--    enabling indexed sequential scans. Recent bounded context (e.g. last 10 messages)
--    is passed to LLM calls to prevent context window exhaustion and high token latency.
--
-- 3. Proposal TTL & Cleanup:
--    The (user_id, expires_at, status) index allows rapid evaluation of active vs expired
--    proposals and fast execution of periodic batch expiry/garbage-collection jobs.
--
-- 4. Multi-Tenancy Architecture (business_id):
--    To extend this schema for multi-tenant SaaS (multiple clinics/businesses):
--    - Add `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
--      to `appointments`, `booking_proposals`, and `chat_sessions`.
--    - Update exclusion constraint to include business_id:
--      EXCLUDE USING GIST (business_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
--      WHERE (status = 'confirmed');
--    - Enforce Row-Level Security (RLS) in PostgreSQL with tenant isolation policies.
