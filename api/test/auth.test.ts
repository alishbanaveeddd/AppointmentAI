/**
 * M3 — Authentication API integration tests.
 *
 * Tests signup, login, logout, and me endpoints using supertest.
 * Tests run against the test database with per-test cleanup.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { validateEnv } from '../src/config/env';
import { clearRateLimitStore } from '../src/middleware/rate-limiter';

const env = validateEnv();
const prisma = new PrismaClient({ log: ['error'] });
const TEST_BCRYPT_ROUNDS = 4;

function createTestApp() {
  return createApp({ prisma, env, bcryptRounds: TEST_BCRYPT_ROUNDS });
}

function extractCookies(res: request.Response): string[] {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return [];
  if (Array.isArray(setCookie)) return setCookie.map((c) => c.split(';')[0]);
  return [setCookie.split(';')[0]];
}

beforeAll(async () => {
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

async function createUserDirectly(email: string, password: string, name = 'Test User') {
  const passwordHash = await bcrypt.hash(password, TEST_BCRYPT_ROUNDS);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });
}

describe('Auth API (M3)', () => {
  describe('POST /auth/signup', () => {
    it('creates a new user and returns 201 with user summary', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Alice Example',
        email: 'alice@example.com',
        password: 'SecurePass1',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.name).toBe('Alice Example');
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('sets a JWT in an HttpOnly cookie (not in response body)', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Bob Example',
        email: 'bob@example.com',
        password: 'SecurePass1',
      });

      expect(res.status).toBe(201);
      const cookies = extractCookies(res);
      const authCookie = cookies.find((c) => c.startsWith('auth_token='));
      expect(authCookie).toBeDefined();

      const setCookieHeaders = res.headers['set-cookie'] as string[] | string;
      const cookieStr = Array.isArray(setCookieHeaders)
        ? setCookieHeaders.join('; ')
        : setCookieHeaders;
      expect(cookieStr).toMatch(/HttpOnly/);
      expect(JSON.stringify(res.body)).not.toContain('auth_token');
      expect(JSON.stringify(res.body)).not.toContain('eyJ');
    });

    it('returns 409 when email is already registered', async () => {
      const app = createTestApp();
      await request(app).post('/api/auth/signup').send({
        name: 'Carol',
        email: 'carol@example.com',
        password: 'SecurePass1',
      });

      const res = await request(app).post('/api/auth/signup').send({
        name: 'Carol Two',
        email: 'carol@example.com',
        password: 'SecurePass2',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 for invalid email format', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Dave',
        email: 'not-an-email',
        password: 'SecurePass1',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password too short', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Eve',
        email: 'eve@example.com',
        password: 'Short1',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password missing complexity', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Frank',
        email: 'frank@example.com',
        password: 'alllowercase',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing required fields', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Grace',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
        beforeEach(async () => {
      await createUserDirectly('login@example.com', 'SecurePass1', 'Login User');
    });

    it('logs in with valid credentials and returns 200', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'SecurePass1',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('login@example.com');
    });

    it('sets a JWT cookie on successful login', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'SecurePass1',
      });

      expect(res.status).toBe(200);
      const cookies = extractCookies(res);
      const authCookie = cookies.find((c) => c.startsWith('auth_token='));
      expect(authCookie).toBeDefined();
    });

    it('returns 401 with generic message for wrong password', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'WrongPass1',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('returns 401 with generic message for non-existent email', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'SecurePass1',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('does not distinguish between wrong password and non-existent email', async () => {
      const app = createTestApp();

      const resWrongPassword = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'WrongPass1',
      });

      const resNonexistent = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'SecurePass1',
      });

      expect(resWrongPassword.status).toBe(resNonexistent.status);
      expect(resWrongPassword.body.error.message).toBe(
        resNonexistent.body.error.message,
      );
    });

                it('returns 400 for missing fields', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the auth cookie and returns 204', async () => {
      const app = createTestApp();

      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Logout Test',
        email: 'logouttest@example.com',
        password: 'SecurePass1',
      });
      expect(signupRes.status).toBe(201);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', extractCookies(signupRes).join('; '));

      expect(res.status).toBe(204);

      const setCookieHeaders = res.headers['set-cookie'] as string[] | string;
      const cookieStr = Array.isArray(setCookieHeaders)
        ? setCookieHeaders.join('; ')
        : setCookieHeaders;
      expect(cookieStr).toMatch(/Expires=.*1970|Max-Age=0|auth_token=;/);
    });

    it('returns 204 even without an existing cookie', async () => {
      const app = createTestApp();
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(204);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user when authenticated', async () => {
      const app = createTestApp();

      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Me User',
        email: 'me@example.com',
        password: 'SecurePass1',
      });
      expect(signupRes.status).toBe(201);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', extractCookies(signupRes).join('; '));

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('me@example.com');
      expect(res.body.user.name).toBe('Me User');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without a cookie', async () => {
      const app = createTestApp();
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 with an invalid token', async () => {
      const app = createTestApp();
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'auth_token=invalid.jwt.token');
      expect(res.status).toBe(401);
    });
  });
});

describe('Cookie security (M3)', () => {
  it('sets SameSite=Strict on auth cookie', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Cookie Test',
      email: 'cookie@example.com',
      password: 'SecurePass1',
    });

    expect(res.status).toBe(201);
    const setCookieHeaders = res.headers['set-cookie'] as string[] | string;
    const cookieStr = Array.isArray(setCookieHeaders)
      ? setCookieHeaders.join('; ')
      : setCookieHeaders;
    expect(cookieStr).toMatch(/SameSite=Strict/);
  });

  it('sets HttpOnly on auth cookie', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      name: 'HttpOnly Test',
      email: 'httponly@example.com',
      password: 'SecurePass1',
    });

    expect(res.status).toBe(201);
    const setCookieHeaders = res.headers['set-cookie'] as string[] | string;
    const cookieStr = Array.isArray(setCookieHeaders)
      ? setCookieHeaders.join('; ')
      : setCookieHeaders;
    expect(cookieStr).toMatch(/HttpOnly/);
  });
});


