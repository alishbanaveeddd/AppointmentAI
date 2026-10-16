/**
 * M1 health endpoint tests.
 *
 * Verifies GET /api/health returns 200 with a structured body
 * and does not expose secrets or internal configuration.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { healthHandler } from '../src/routes/health';

// Create a minimal app for testing (without starting the server or env validation)
function createApp(): Express {
  const app = express();
  app.get('/api/health', healthHandler);
  return app;
}

describe('health endpoint (M1)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('returns 200 with structured body', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('does not expose secrets or internal configuration', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).not.toHaveProperty('NODE_ENV');
    expect(res.body).not.toHaveProperty('DATABASE_URL');
    expect(res.body).not.toHaveProperty('JWT_SECRET');
    expect(res.body).not.toHaveProperty('FRONTEND_URL');
    expect(res.body).not.toHaveProperty('GROQ_API_KEY');
    expect(res.body).not.toHaveProperty('PORT');
    expect(res.body).not.toHaveProperty('env');
  });
});
