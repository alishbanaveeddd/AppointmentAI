/**
 * Appointment AI API — M3 entry point.
 *
 * M3 scope: authentication (signup, login, logout, me), JWT cookie session
 * management, password hashing, rate limiting, request ID, structured logging,
 * CORS, origin validation, and error handling.
 *
 * Bootstrap sequence:
 *   1. Validate all environment variables (NODE_ENV, PORT, DATABASE_URL,
 *      JWT_SECRET, FRONTEND_URL).
 *   2. Initialize Prisma client.
 *   3. Create configured Express app (via createApp factory).
 *   4. Listen on the validated port.
 */
import { PrismaClient } from '@prisma/client';
import { validateEnv } from './config/env';
import { createApp } from './app';

/**
 * M8: Load environment variables from .env before validation.
 * Uses Node's native process.loadEnvFile (Node 20+) because dotenv is not
 * installed as a runtime dependency in this project.
 * In test mode, test/setup.ts handles its own loading.
 * Per docs/SECURITY.md: secrets are never logged or returned to clients.
 */
if (process.env.NODE_ENV !== 'test') {
  const loadEnv = (
    process as { loadEnvFile?: (path?: string) => void }
  ).loadEnvFile;
  if (typeof loadEnv === 'function') {
    try {
      loadEnv();
    } catch {
      /* No .env file found — rely on shell environment variables. */
    }
  }
}

// --- 1. Environment validation (before server starts) ---
const env = validateEnv();

// --- 2. Prisma client ---
const prisma = new PrismaClient({ log: ['error'] });

// --- 3. Configured Express application ---
const app = createApp({ prisma, env });

// --- 4. Start server ---
app.listen(env.PORT, () => {
  console.log(`Appointment AI API — M3 authentication — listening on port ${env.PORT}`);
  console.log(`Health: http://localhost:${env.PORT}/api/health`);
  console.log(`Auth:   http://localhost:${env.PORT}/api/auth`);
});
