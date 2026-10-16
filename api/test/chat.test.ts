/**
 * M5 - Chat sessions and messages integration tests.
 *
 * Tests the chat API endpoints:
 * - Session creation (with/without title)
 * - Session listing with ownership isolation
 * - Message retrieval (ordering, persistence)
 * - Message sending (assistant response, booking state, auto-title)
 * - Validation (empty/missing/too-long content)
 * - Error states (unauth, 404, non-owned session)
 * - Deterministic assistant behavior
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { validateEnv } from '../src/config/env';
import { clearRateLimitStore } from '../src/middleware/rate-limiter';
import { fakeAssistantAdapter, type AssistantAdapter } from '../src/services/chat';

const env = validateEnv();
const prisma = new PrismaClient({ log: ['error'] });
const TEST_BCRYPT_ROUNDS = 4;

function createTestApp(): Express {
  // M6: inject the deterministic fake adapter so existing chat API tests stay
  // deterministic (production uses the Groq adapter wired in createApp).
  const assistantAdapter: AssistantAdapter = (params) =>
    Promise.resolve(fakeAssistantAdapter(params.content));
  return createApp({ prisma, env, bcryptRounds: TEST_BCRYPT_ROUNDS, assistantAdapter });
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

describe('Chat API - sessions (M5)', () => {
  describe('POST /chat/sessions', () => {
    it('creates a new session and returns 201 with session summary', async () => {
      const cookies = await signUp(app, 'session1@example.com', 'User One');
      const res = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('session');
      expect(res.body.session).toHaveProperty('id');
      expect(res.body.session).toHaveProperty('createdAt');
      expect(res.body.session).toHaveProperty('updatedAt');
    });

    it('creates a session with a provided title', async () => {
      const cookies = await signUp(app, 'session2@example.com', 'User Two');
      const res = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: 'My Booking Session' });

      expect(res.status).toBe(201);
      expect(res.body.session.title).toBe('My Booking Session');
    });

    it('creates a session without a title (nullable title)', async () => {
      const cookies = await signUp(app, 'session3@example.com', 'User Three');
      const res = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.session.title).toBeNull();
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/api/chat/sessions').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 400 for an empty title string', async () => {
      const cookies = await signUp(app, 'session4@example.com', 'User Four');
      const res = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /chat/sessions', () => {
    it('lists only the current user sessions (ownership isolation)', async () => {
      const cookiesA = await signUp(app, 'owner1@example.com', 'Owner One');
      const cookiesB = await signUp(app, 'owner2@example.com', 'Owner Two');

      await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookiesA.join('; '))
        .send({ title: 'Session A1' });
      await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookiesA.join('; '))
        .send({ title: 'Session A2' });
      await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookiesB.join('; '))
        .send({ title: 'Session B1' });

      const resA = await request(app).get('/api/chat/sessions').set('Cookie', cookiesA.join('; '));

      expect(resA.status).toBe(200);
      expect(resA.body.sessions).toHaveLength(2);
      const ownerAId = resA.body.sessions[0].userId;
      expect(resA.body.sessions.every((s: any) => s.userId === ownerAId)).toBe(true);

      const resB = await request(app).get('/api/chat/sessions').set('Cookie', cookiesB.join('; '));

      expect(resB.status).toBe(200);
      expect(resB.body.sessions).toHaveLength(1);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/chat/sessions');
      expect(res.status).toBe(401);
    });

    it('returns sessions ordered by updatedAt descending', async () => {
      const cookies = await signUp(app, 'order1@example.com', 'Order One');
      await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: 'First' });
      await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: 'Second' });

      const res = await request(app).get('/api/chat/sessions').set('Cookie', cookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(2);
      expect(res.body.sessions[0].title).toBe('Second');
      expect(res.body.sessions[1].title).toBe('First');
    });
  });
});

describe('Chat API - messages (M5)', () => {
  describe('GET /chat/sessions/:sessionId/messages', () => {
    it('returns ordered messages for an active session', async () => {
      const cookies = await signUp(app, 'msg1@example.com', 'Msg One');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: 'Test Session' });
      const sessionId = createRes.body.session.id;

      await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'Hello there' });

      await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'Follow-up message' });

      const res = await request(app)
        .get('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(4);
      expect(res.body.messages[0].role).toBe('user');
      expect(res.body.messages[0].content).toBe('Hello there');
      expect(res.body.messages[1].role).toBe('assistant');
      expect(res.body.messages[2].role).toBe('user');
      expect(res.body.messages[2].content).toBe('Follow-up message');
      expect(res.body.messages[3].role).toBe('assistant');
    });

    it('returns empty array for a session with no messages', async () => {
      const cookies = await signUp(app, 'msg2@example.com', 'Msg Two');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: 'Empty Session' });
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .get('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
    });

    it('returns 404 for a non-existent session ID', async () => {
      const cookies = await signUp(app, 'msg3@example.com', 'Msg Three');
      const fakeId = '12345678-1234-1234-1234-123456789abc';

      const res = await request(app)
        .get('/api/chat/sessions/' + fakeId + '/messages')
        .set('Cookie', cookies.join('; '));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for another user session (ownership isolation)', async () => {
      const cookiesA = await signUp(app, 'msg4a@example.com', 'Msg Four A');
      const cookiesB = await signUp(app, 'msg4b@example.com', 'Msg Four B');

      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookiesA.join('; '))
        .send({ title: 'Private Session' });
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .get('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookiesB.join('; '));

      expect(res.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/chat/sessions/some-id/messages');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /chat/sessions/:sessionId/messages', () => {
    it('sends a message and returns assistant response with 200', async () => {
      const cookies = await signUp(app, 'send1@example.com', 'Send One');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'I want to book an appointment' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message.role).toBe('assistant');
      expect(res.body.message).toHaveProperty('id');
      expect(res.body.message).toHaveProperty('content');
      expect(res.body).toHaveProperty('booking');
    });

    it('returns collecting_details state with missing fields', async () => {
      const cookies = await signUp(app, 'send2@example.com', 'Send Two');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'book appointment' });

      expect(res.status).toBe(200);
      expect(res.body.booking.state).toBe('collecting_details');
      expect(res.body.booking.missingFields).toContain('service');
      expect(res.body.booking.missingFields).toContain('requested_date');
      expect(res.body.booking.missingFields).toContain('requested_time');
      expect(res.body.booking.proposal).toBeNull();
    });

    it('persists both user and assistant messages (persistence after refresh)', async () => {
      const cookies = await signUp(app, 'send3@example.com', 'Send Three');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({ title: 'Persist Test' });
      const sessionId = createRes.body.session.id;

      const sendRes = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'Hello, I need an appointment' });

      expect(sendRes.status).toBe(200);

      const res = await request(app)
        .get('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].role).toBe('user');
      expect(res.body.messages[0].content).toBe('Hello, I need an appointment');
      expect(res.body.messages[1].role).toBe('assistant');
      expect(res.body.messages[1].content).toBe(sendRes.body.message.content);
    });

    it('auto-generates a session title from the first user message', async () => {
      const cookies = await signUp(app, 'send4@example.com', 'Send Four');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      expect(createRes.body.session.title).toBeNull();
      const sessionId = createRes.body.session.id;

      await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'Book a consultation for next Monday morning' });

      const listRes = await request(app)
        .get('/api/chat/sessions')
        .set('Cookie', cookies.join('; '));

      expect(listRes.status).toBe(200);
      const session = listRes.body.sessions.find((s: any) => s.id === sessionId);
      expect(session.title).toBe('Book a consultation for next Monday morning');
    });

    it('truncates long titles to 50 chars with ellipsis', async () => {
      const cookies = await signUp(app, 'send5@example.com', 'Send Five');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      const sessionId = createRes.body.session.id;

      const longContent = 'Book a consultation for next Monday morning at ten o clock';
      await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: longContent });

      const listRes = await request(app)
        .get('/api/chat/sessions')
        .set('Cookie', cookies.join('; '));

      const session = listRes.body.sessions.find((s: any) => s.id === sessionId);
      expect(session.title).toHaveLength(53);
    });

    it('returns 400 for empty content', async () => {
      const cookies = await signUp(app, 'send6@example.com', 'Send Six');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing content field', async () => {
      const cookies = await signUp(app, 'send7@example.com', 'Send Seven');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for content exceeding max length', async () => {
      const cookies = await signUp(app, 'send8@example.com', 'Send Eight');
      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookies.join('; '))
        .send({});
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'a'.repeat(4001) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for a non-existent session', async () => {
      const cookies = await signUp(app, 'send9@example.com', 'Send Nine');
      const fakeId = '12345678-1234-1234-1234-123456789abc';

      const res = await request(app)
        .post('/api/chat/sessions/' + fakeId + '/messages')
        .set('Cookie', cookies.join('; '))
        .send({ content: 'Hello' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when sending to another user session', async () => {
      const cookiesA = await signUp(app, 'send10a@example.com', 'Send Ten A');
      const cookiesB = await signUp(app, 'send10b@example.com', 'Send Ten B');

      const createRes = await request(app)
        .post('/api/chat/sessions')
        .set('Cookie', cookiesA.join('; '))
        .send({ title: 'Private' });
      const sessionId = createRes.body.session.id;

      const res = await request(app)
        .post('/api/chat/sessions/' + sessionId + '/messages')
        .set('Cookie', cookiesB.join('; '))
        .send({ content: 'Hello from B' });

      expect(res.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/chat/sessions/some-id/messages')
        .send({ content: 'Hello' });

      expect(res.status).toBe(401);
    });
  });
});

describe('Chat API - deterministic assistant (M5)', () => {
  it('returns booking-related response for appointment keywords', () => {
    const result = fakeAssistantAdapter('I want to book an appointment');
    expect(result.booking.state).toBe('collecting_details');
    expect(result.booking.missingFields).toEqual(['service', 'requested_date', 'requested_time']);
    expect(result.booking.proposal).toBeNull();
    expect(result.text).toContain('appointment');
  });

  it('returns greeting for hello messages', () => {
    const result = fakeAssistantAdapter('Hello there');
    expect(result.booking.state).toBe('collecting_details');
    expect(result.text).toMatch(/Hello/i);
  });

  it('returns general response for unrelated messages', () => {
    const result = fakeAssistantAdapter('What is the weather today?');
    expect(result.booking.state).toBe('collecting_details');
    expect(result.text).toMatch(/help/i);
  });

  it('produces identical output for identical input (deterministic)', () => {
    const input = 'I need to schedule a consultation';
    const result1 = fakeAssistantAdapter(input);
    const result2 = fakeAssistantAdapter(input);
    expect(result1).toEqual(result2);
  });
});
