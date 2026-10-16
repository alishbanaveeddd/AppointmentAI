/**
 * M3 — Express application factory.
 *
 * Creates and configures an Express app with all M3 middleware:
 * - Request ID generation
 * - Structured logging
 * - CORS (restrictive allowlist)
 * - JSON body size limits
 * - Cookie parsing
 * - Origin validation (state-changing requests)
 *
 * Returns the configured app (does not start listening) so it can be
 * used in tests with supertest.
 *
 * Per docs/ARCHITECTURE.md: routes are thin; business logic lives in
 * services. The app factory wires dependencies and middleware.
 */
import express from 'express';
import type { Express } from 'express';
import cookieParser from 'cookie-parser';
import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { loggerMiddleware } from './middleware/logger';
import { createCorsMiddleware, createOriginCheckMiddleware } from './middleware/cors';
import { createAuthRouter } from './routes/auth';
import { createAppointmentRouter } from './routes/appointments';
import { createChatRouter } from './routes/chat';
import { createGroqAdapter } from './services/groq';
import { createAppointmentService } from './services/appointment';
import type { AssistantAdapter } from './services/chat';
import { healthHandler } from './routes/health';
import { errorHandler } from './middleware/error-handler';

export interface AppDeps {
  prisma: PrismaClient;
  env: Env;
  bcryptRounds?: number;
  now?: () => Date;
  /** M6: inject a real or fake adapter (tests inject the fake for determinism). */
  assistantAdapter?: AssistantAdapter;
}

/**
 * Creates a configured Express application.
 * @param deps Dependencies: Prisma client, env config, optional bcrypt rounds.
 * @returns A configured Express app (not started).
 */
export function createApp(deps: AppDeps): Express {
  const { prisma, env, bcryptRounds, now } = deps;

  const app = express();

  // --- 1. Request ID (must be first for request correlation) ---
  app.use(requestIdMiddleware);

  // --- 2. Structured logging ---
  app.use(loggerMiddleware);

  // --- 3. CORS (restrictive allowlist) ---
  app.use(createCorsMiddleware(env));

  // --- 4. Body parsing with size limit ---
  app.use(express.json({ limit: '10kb' }));

  // --- 5. Cookie parsing (for JWT cookie) ---
  app.use(cookieParser());

  // --- 6. Origin validation (defense in depth on state-changing methods) ---
  app.use(createOriginCheckMiddleware(env));

  // --- 7. Routes ---
  // Health endpoint — no authentication required (per API_CONTRACT.md).
  app.get('/api/health', healthHandler);

  // Auth routes � signup, login, logout (no auth required).
  app.use('/api/auth', createAuthRouter({ prisma, env, bcryptRounds }));

  // Appointment routes — proposals, confirmations, management (requires auth).
  // M7: create a single shared appointment service used by both the appointment
  // router (direct API) and the chat router (AI-driven booking flow).
  const appointmentService = createAppointmentService({ prisma, now });
  app.use('/api/appointments', createAppointmentRouter({ prisma, now, appointmentService }));

  // Chat routes — sessions and messages (requires auth).
  // M6: production uses the Groq-backed adapter wired from validated env;
  // tests may inject the deterministic fake adapter via AppDeps.
  const chatAdapter =
    deps.assistantAdapter ?? createGroqAdapter({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL });
  app.use('/api/chat', createChatRouter({ prisma, assistantAdapter: chatAdapter, appointmentService }));

  // --- 8. 404 handler for unknown routes ---
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        requestId: _req.id,
      },
    });
  });

  // --- 9. Error handler (must be last) ---
  app.use(errorHandler);

  return app;
}
