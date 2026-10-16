/**
 * M7 — Conversational booking and confirmation (integration).
 *
 * Tests the chat service's M7 booking flow end-to-end through the HTTP API:
 * - Complete extraction → proposal creation → awaiting_confirmation
 * - Missing fields → clarification, no proposal
 * - "yes" with pending proposal → appointment created
 * - "yes" without pending proposal → no booking
 * - User changes date → new proposal, old one discarded
 * - Business-hours violation → clarification
 * - Past date → clarification
 * - Slot conflict on confirmation → structured recovery
 * - Expired proposal → structured recovery
 * - Idempotent confirmation → no duplicate
 *
 * Uses a test-specific adapter that returns AiExtraction objects for
 * specific message strings.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { validateEnv } from '../src/config/env';
import { clearRateLimitStore } from '../src/middleware/rate-limiter';
import type { AssistantAdapter, BookingState } from '../src/services/chat';
import type { AiExtraction } from '../src/schemas/ai';
import { BOOKING_TIMEZONE } from '../src/config/booking';

const env = validateEnv();
const prisma = new PrismaClient({ log: ['error'] });
const TEST_BCRYPT_ROUNDS = 4;

/* ---------- Test adapter: returns AiExtraction for known messages ---------- */

const COMPLETE_EXTRACTION: AiExtraction = {
  intent: 'book_appointment',
  service: 'Consultation',
  requested_date: '2026-10-19',
  requested_time: '10:00',
  duration_minutes: 30,
  missingFields: [],
  clarification_question: null,
};

const ALTERNATE_EXTRACTION: AiExtraction = {
  intent: 'book_appointment',
  service: 'Consultation',
  requested_date: '2026-10-20',
  requested_time: '11:00',
  duration_minutes: 30,
  missingFields: [],
  clarification_question: null,
};

const AFTER_HOURS_EXTRACTION: AiExtraction = {
  intent: 'book_appointment',
  service: 'Consultation',
  requested_date: '2026-10-19',
  requested_time: '20:00',
  duration_minutes: 30,
  missingFields: [],
  clarification_question: null,
};

const PAST_EXTRACTION: AiExtraction = {
  intent: 'book_appointment',
  service: 'Consultation',
  requested_date: '2026-10-14',
  requested_time: '10:00',
  duration_minutes: 30,
  missingFields: [],
  clarification_question: null,
};

const PARTIAL_EXTRACTION: AiExtraction = {
  intent: 'book_appointment',
  service: 'Consultation',
  requested_date: null,
  requested_time: null,
  duration_minutes: null,
  missingFields: ['requested_date', 'requested_time'],
  clarification_question: null,
};

const EXTRACTION_MAP: Record<string, AiExtraction> = {
  'book consultation 2026-10-19 10:00': COMPLETE_EXTRACTION,
  'book consultation 2026-10-20 11:00': ALTERNATE_EXTRACTION,
  'book consultation 2026-10-19 20:00': AFTER_HOURS_EXTRACTION,
  'book consultation 2026-10-14 10:00': PAST_EXTRACTION,
  'book consultation': PARTIAL_EXTRACTION,
};

const testAdapter: AssistantAdapter = (params) => {
  const key = params.content.trim().toLowerCase();
  const extraction = EXTRACTION_MAP[key];

  if (extraction) {
    const text =
      extraction.missingFields.length === 0
        ? `Extracted: ${extraction.service} on ${extraction.requested_date} at ${extraction.requested_time}`
        : `Missing: ${extraction.missingFields.join(', ')}`;

    return Promise.resolve({
      text,
      booking: {
        state: 'collecting_details' as BookingState,
        missingFields: extraction.missingFields,
        proposal: null,
      },
      extraction,
    });
  }

  return Promise.resolve({
    text: 'How can I help you today?',
    booking: {
      state: 'collecting_details' as BookingState,
      missingFields: ['service', 'requested_date', 'requested_time'],
      proposal: null,
    },
  });
};

/* ---------- Test helpers ---------- */

function createTestApp(): Express {
  return createApp({
    prisma,
    env,
    bcryptRounds: TEST_BCRYPT_ROUNDS,
    assistantAdapter: testAdapter,
  });
}

function extractCookies(res: request.Response): string[] {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return [];
  if (Array.isArray(setCookie)) return setCookie.map((c) => c.split(';')[0]);
  return [setCookie.split(';')[0]];
}

async function signUp(app: Express, email: string, name: string) {
  const res = await request(app).post('/api/auth/signup').send({
    name,
    email,
    password: 'SecurePass1',
  });
  return extractCookies(res);
}

async function createSession(app: Express, cookies: string[]) {
  const res = await request(app)
    .post('/api/chat/sessions')
    .set('Cookie', cookies.join('; '))
    .send({});
  return res.body.session;
}

async function sendMessage(
  app: Express,
  sessionId: string,
  cookies: string[],
  content: string,
) {
  return request(app)
    .post(`/api/chat/sessions/${sessionId}/messages`)
    .set('Cookie', cookies.join('; '))
    .send({ content });
}

// Helper: compute UTC start/end for a Karachi-local date+time (UTC+5, no DST)
function karachiToUtc(year: number, month: number, day: number, hour: number, minute: number): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt = new Date(Date.UTC(year, month - 1, day, hour - 5, minute, 0, 0));
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  return { startsAt, endsAt };
}

let app: Express;

beforeAll(async () => {
  app = createTestApp();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;',
  );
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;',
  );
  clearRateLimitStore();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/* ---------- M7 tests ---------- */

describe('M7 — Conversational booking (chat API)', () => {
  it('creates a proposal from a complete extraction (awaiting_confirmation)', async () => {
    const cookies = await signUp(app, 'm7-proposal@example.com', 'M7 Proposal');
    const session = await createSession(app, cookies);

    const res = await sendMessage(app, session.id, cookies, 'book consultation 2026-10-19 10:00');

    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('awaiting_confirmation');
    expect(res.body.booking.missingFields).toEqual([]);
    expect(res.body.booking.proposal).toMatchObject({
      proposalId: expect.any(String),
      service: 'Consultation',
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    expect(res.body.booking.proposal.expiresAt).toBeDefined();

    const proposal = await prisma.bookingProposal.findUnique({
      where: { proposalId: res.body.booking.proposal.proposalId },
    });
    expect(proposal).not.toBeNull();
    expect(proposal!.status).toBe('pending');
  });

  it('does not create a proposal when fields are missing', async () => {
    const cookies = await signUp(app, 'm7-missing@example.com', 'M7 Missing');
    const session = await createSession(app, cookies);

    const res = await sendMessage(app, session.id, cookies, 'book consultation');

    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('collecting_details');
    expect(res.body.booking.missingFields).toEqual(['requested_date', 'requested_time']);
    expect(res.body.booking.proposal).toBeNull();

    const count = await prisma.bookingProposal.count();
    expect(count).toBe(0);
  });

  it('does not book when user says "yes" without a pending proposal', async () => {
    const cookies = await signUp(app, 'm7-yes-noproposal@example.com', 'M7 YesNo');
    const session = await createSession(app, cookies);

    const res = await sendMessage(app, session.id, cookies, 'yes');

    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('collecting_details');
    expect(res.body).not.toHaveProperty('appointment');

    const appointmentCount = await prisma.appointment.count();
    expect(appointmentCount).toBe(0);
  });

  it('confirms a pending proposal and creates an appointment', async () => {
    const cookies = await signUp(app, 'm7-confirm@example.com', 'M7 Confirm');
    const session = await createSession(app, cookies);

    const proposalRes = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-19 10:00');
    expect(proposalRes.body.booking.state).toBe('awaiting_confirmation');
    const proposalId = proposalRes.body.booking.proposal.proposalId;

    const confirmRes = await sendMessage(app, session.id, cookies, 'yes');

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.booking.state).toBe('booked');
    expect(confirmRes.body.booking.proposal).toBeNull();
    expect(confirmRes.body.appointment).toMatchObject({
      id: expect.any(String),
      service: 'Consultation',
      status: 'confirmed',
    });

    const appt = await prisma.appointment.findUnique({
      where: { id: confirmRes.body.appointment.id },
    });
    expect(appt).not.toBeNull();
    expect(appt!.service).toBe('Consultation');

    const proposal = await prisma.bookingProposal.findUnique({
      where: { proposalId },
    });
    expect(proposal!.status).toBe('confirmed');
    expect(proposal!.appointmentId).toBe(appt!.id);
  });

  it('does not create a duplicate on repeated confirmation', async () => {
    const cookies = await signUp(app, 'm7-idempotent@example.com', 'M7 Idempotent');
    const session = await createSession(app, cookies);

    await sendMessage(app, session.id, cookies, 'book consultation 2026-10-19 10:00');
    await sendMessage(app, session.id, cookies, 'yes');

    const secondRes = await sendMessage(app, session.id, cookies, 'yes');
    expect(secondRes.status).toBe(200);

    const appointmentCount = await prisma.appointment.count();
    expect(appointmentCount).toBe(1);
    expect(secondRes.body.booking.state).toBe('collecting_details');
  });

  it('invalidates old proposal when user provides new date/time', async () => {
    const cookies = await signUp(app, 'm7-change@example.com', 'M7 Change');
    const session = await createSession(app, cookies);

    const firstRes = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-19 10:00');
    expect(firstRes.body.booking.state).toBe('awaiting_confirmation');
    const firstProposalId = firstRes.body.booking.proposal.proposalId;

    const secondRes = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-20 11:00');
    expect(secondRes.body.booking.state).toBe('awaiting_confirmation');
    expect(secondRes.body.booking.proposal.proposalId).not.toBe(firstProposalId);

    const confirmRes = await sendMessage(app, session.id, cookies, 'yes');
    expect(confirmRes.body.booking.state).toBe('booked');

    const { startsAt: expectedStarts } = karachiToUtc(2026, 10, 20, 11, 0);
    const appt = await prisma.appointment.findUnique({
      where: { id: confirmRes.body.appointment.id },
    });
    expect(appt!.startsAt.getTime()).toBe(expectedStarts.getTime());
  });

  it('handles business-hours violation with a clarification message', async () => {
    const cookies = await signUp(app, 'm7-hours@example.com', 'M7 Hours');
    const session = await createSession(app, cookies);

    const res = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-19 20:00');

    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('collecting_details');
    expect(res.body.booking.missingFields).toContain('requested_date');
    expect(res.body.booking.missingFields).toContain('requested_time');
    expect(res.body.booking.proposal).toBeNull();
    expect(res.body.message.content).toMatch(/business hours|Monday|9 AM|5 PM/i);

    const proposalCount = await prisma.bookingProposal.count();
    expect(proposalCount).toBe(0);
  });

  it('handles past date with a clarification message', async () => {
    const cookies = await signUp(app, 'm7-past@example.com', 'M7 Past');
    const session = await createSession(app, cookies);

    const res = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-14 10:00');

    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('collecting_details');
    expect(res.body.booking.proposal).toBeNull();
    expect(res.body.message.content).toMatch(/past|passed|future/i);

    const proposalCount = await prisma.bookingProposal.count();
    expect(proposalCount).toBe(0);
  });

  it('handles slot conflict on confirmation (structured recovery)', async () => {
    const cookies = await signUp(app, 'm7-conflict@example.com', 'M7 Conflict');
    const session = await createSession(app, cookies);
    const user = await prisma.user.findUnique({
      where: { email: 'm7-conflict@example.com' },
    });

    // Pre-create a confirmed appointment at the same slot
    const { startsAt, endsAt } = karachiToUtc(2026, 10, 19, 10, 0);
    await prisma.appointment.create({
      data: {
        userId: user!.id,
        service: 'Existing appointment',
        startsAt,
        endsAt,
        status: 'confirmed',
      },
    });

    const proposalRes = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-19 10:00');
    expect(proposalRes.body.booking.state).toBe('awaiting_confirmation');

    const confirmRes = await sendMessage(app, session.id, cookies, 'yes');
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.booking.state).toBe('awaiting_confirmation');
    expect(confirmRes.body.booking.missingFields).toEqual(['requested_date', 'requested_time']);
    expect(confirmRes.body.booking.proposal).toBeNull();
    expect(confirmRes.body.message.content).toMatch(/no longer available|different/i);
    expect(confirmRes.body).not.toHaveProperty('appointment');
  });

  it('handles expired proposal on confirmation (structured recovery)', async () => {
    const cookies = await signUp(app, 'm7-expired@example.com', 'M7 Expired');
    const session = await createSession(app, cookies);

    const proposalRes = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-19 10:00');
    const proposalId = proposalRes.body.booking.proposal.proposalId;

    await prisma.bookingProposal.update({
      where: { proposalId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const confirmRes = await sendMessage(app, session.id, cookies, 'yes');
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.booking.state).toBe('collecting_details');
    expect(confirmRes.body.booking.missingFields).toEqual([
      'service', 'requested_date', 'requested_time',
    ]);
    expect(confirmRes.body.booking.proposal).toBeNull();
    expect(confirmRes.body.message.content).toMatch(/expired|start over/i);
    expect(confirmRes.body).not.toHaveProperty('appointment');
  });

  it('re-presents a pending proposal when user asks a non-booking question', async () => {
    const cookies = await signUp(app, 'm7-represent@example.com', 'M7 RePresent');
    const session = await createSession(app, cookies);

    await sendMessage(app, session.id, cookies, 'book consultation 2026-10-19 10:00');

    const res = await sendMessage(app, session.id, cookies, 'what is the status?');
    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('awaiting_confirmation');
    expect(res.body.booking.proposal).not.toBeNull();
    expect(res.body.booking.proposal.service).toBe('Consultation');
    expect(res.body.message.content).toMatch(/Previously proposed/i);
  });

  it('handles negation ("no") while awaiting confirmation', async () => {
    const cookies = await signUp(app, 'm7-no@example.com', 'M7 No');
    const session = await createSession(app, cookies);

    await sendMessage(app, session.id, cookies, 'book consultation 2026-10-19 10:00');

    const res = await sendMessage(app, session.id, cookies, 'no');
    expect(res.status).toBe(200);
    expect(res.body.booking.state).toBe('collecting_details');
    expect(res.body.booking.proposal).toBeNull();
    expect(res.body.message.content).toMatch(/set that aside|different time/i);

    const appointmentCount = await prisma.appointment.count();
    expect(appointmentCount).toBe(0);
  });

  it('persists session metadata with booking state across messages', async () => {
    const cookies = await signUp(app, 'm7-state@example.com', 'M7 State');
    const session = await createSession(app, cookies);

    const res1 = await sendMessage(
      app, session.id, cookies, 'book consultation 2026-10-19 10:00');
    const proposalId = res1.body.booking.proposal.proposalId;

    const updatedSession = await prisma.chatSession.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession).not.toBeNull();
    const metadata = updatedSession!.metadata as Record<string, unknown>;
    expect(metadata.booking).toMatchObject({
      state: 'awaiting_confirmation',
      proposalId,
    });
  });
});