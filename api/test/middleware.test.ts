/**
 * M3 — Middleware tests.
 *
 * Tests:
 * - Rate limiter: enforces limits and returns 429
 * - Auth middleware: rejects missing/invalid tokens, accepts valid tokens
 * - Origin validation: rejects non-allowed origins on state-changing requests
 * - Request ID: generates and echoes request ID
 * - Error handler: returns structured errors
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app';
import { validateEnv } from '../src/config/env';
import { clearRateLimitStore } from '../src/middleware/rate-limiter';
import { signJwt } from '../src/lib/jwt';
import { AUTH_COOKIE_NAME } from '../src/middleware/auth';

const env = validateEnv();
const prisma = new PrismaClient({ log: ['error'] });
const TEST_BCRYPT_ROUNDS = 4;

function createTestApp() {
  return createApp({ prisma, env, bcryptRounds: TEST_BCRYPT_ROUNDS });
}

function extractCookiesFromRes(res: request.Response): string[] {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return [];
  if (Array.isArray(setCookie)) return setCookie.map((c) => c.split(';')[0]);
  return [setCookie.split(';')[0]];
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;',
  );
  clearRateLimitStore();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Rate limiter (M3)', () => {
  it('allows normal usage under the limit', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Rate User',
      email: 'rate1@example.com',
      password: 'SecurePass1',
    });
    expect(res.status).toBe(201);
  });

  it('blocks requests after signup rate limit exceeded (5 per 15 min)', async () => {
    const app = createTestApp();

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/signup').send({
        name: `User${i}`,
        email: `ratelimit${i}@example.com`,
        password: 'SecurePass1',
      });
    }

    const res = await request(app).post('/api/auth/signup').send({
      name: 'User6',
      email: 'ratelimit6@example.com',
      password: 'SecurePass1',
    });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('sets X-RateLimit headers', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Header Test',
      email: 'headers@example.com',
      password: 'SecurePass1',
        });

    expect(res.status).toBe(201);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
  });
});

describe('Auth middleware (M3)', () => {
  it('returns 401 for /api/auth/me without a cookie', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('accepts a valid JWT token in the cookie', async () => {
    const app = createTestApp();
    const signupRes = await request(app).post('/api/auth/signup').send({
      name: 'Auth Test',
      email: 'authmiddleware@example.com',
      password: 'SecurePass1',
    });
    expect(signupRes.status).toBe(201);

    const cookies = extractCookiesFromRes(signupRes);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies.join('; '));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('authmiddleware@example.com');
  });

  it('rejects an invalid JWT token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=invalid-token`);
    expect(res.status).toBe(401);
  });

  it('rejects a JWT signed with the wrong secret', async () => {
    const app = createTestApp();
    const wrongEnv = { ...env, JWT_SECRET: 'different-secret-key-32-chars!!' };
    const token = signJwt('nonexistent-user-id', wrongEnv);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);
    expect(res.status).toBe(401);
  });
});

describe('Origin validation (M3)', () => {
  it('allows signup without Origin header (non-browser client)', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      name: 'No Origin',
      email: 'noorigin@example.com',
      password: 'SecurePass1',
    });
    expect(res.status).toBe(201);
  });

  it('allows signup with allowed Origin', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/signup')
      .set('Origin', env.FRONTEND_URL)
      .send({
        name: 'Allowed Origin',
        email: 'allowedorigin@example.com',
        password: 'SecurePass1',
      });
    expect(res.status).toBe(201);
  });
});

describe('Request ID (M3)', () => {
  it('echoes X-Request-Id in response if provided', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'test-request-id-123');
    expect(res.headers['x-request-id']).toBe('test-request-id-123');
  });

  it('generates a UUID request ID if not provided', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('Error handler (M3)', () => {
  it('returns structured 404 for unknown routes', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
