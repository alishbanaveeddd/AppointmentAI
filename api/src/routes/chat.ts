/**
 * M5 — Chat session and message routes.
 *
 * Endpoints (all require authentication per docs/API_CONTRACT.md):
 * - POST   /chat/sessions                         → create session  (201)
 * - GET    /chat/sessions                         → list user's sessions (200)
 * - GET    /chat/sessions/:sessionId/messages     → ordered history (200)
 * - POST   /chat/sessions/:sessionId/messages     → send message, get response (200)
 *
 * Per docs/ARCHITECTURE.md: routes are thin — business logic lives in
 * services. Route handlers parse input, call the service, and map domain
 * errors to structured ApiError responses.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createSessionSchema, createMessageSchema } from '../schemas/chat';
import { createChatService, SessionNotFoundError, type AssistantAdapter } from '../services/chat';
import type { AppointmentService } from '../services/appointment';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { createRateLimiter } from '../middleware/rate-limiter';

export interface ChatRoutesDeps {
  prisma: PrismaClient;
  // M6: inject the Groq adapter in production; tests inject the fake.
  assistantAdapter?: AssistantAdapter;
  /** M7: shared appointment service for AI-driven booking flows. */
  appointmentService?: AppointmentService;
}

// Rate limiter: 60 chat messages per minute per IP (per docs/SECURITY.md).
const chatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

/**
 * Maps a chat service-domain error to a structured ApiError.
 * - 400 for invalid input (already handled by schema validation before service)
 * - 404 for not found / not owned
 */
function mapChatError(err: unknown): ApiError {
  if (err instanceof SessionNotFoundError) {
    return new ApiError(404, 'NOT_FOUND', err.message);
  }
  // Already an ApiError (e.g., from validation)
  if (err instanceof ApiError) {
    return err;
  }
  // Unexpected error — never expose internals to the client
  return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.');
}

export function createChatRouter(deps: ChatRoutesDeps) {
  const { prisma, assistantAdapter, appointmentService } = deps;
  const chatService = createChatService({ prisma, assistantAdapter, appointmentService });
  const router = Router();

  // All chat routes require authentication.
  router.use(requireAuth);

  // POST /chat/sessions — create a new chat session
  router.post('/sessions', (req: Request, res: Response, next: NextFunction) => {
    const parsed = createSessionSchema.safeParse(req.body);

    if (!parsed.success) {
      next(new ApiError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message));
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;

    chatService
      .createSession(userId, parsed.data.title)
      .then((session) => {
        res.status(201).json({ session });
      })
      .catch((err: unknown) => next(mapChatError(err)));
  });

  // GET /chat/sessions — list current user's sessions
  router.get('/sessions', (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).userId;

    chatService
      .listSessions(userId)
      .then((sessions) => {
        res.status(200).json({ sessions });
      })
      .catch((err: unknown) => next(mapChatError(err)));
  });

  // GET /chat/sessions/:sessionId/messages — ordered message history
  router.get(
    '/sessions/:sessionId/messages',
    chatRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
      const { sessionId } = req.params as { sessionId: string };
      const userId = (req as AuthenticatedRequest).userId;

      chatService
        .getMessages(userId, sessionId)
        .then((messages) => {
          res.status(200).json({ messages });
        })
        .catch((err: unknown) => next(mapChatError(err)));
    },
  );

  // POST /chat/sessions/:sessionId/messages — send a message and get assistant response
  router.post(
    '/sessions/:sessionId/messages',
    chatRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
      const { sessionId } = req.params as { sessionId: string };
      const userId = (req as AuthenticatedRequest).userId;

      const parsed = createMessageSchema.safeParse(req.body);

      if (!parsed.success) {
        next(new ApiError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message));
        return;
      }

      chatService
        .sendMessage(userId, sessionId, parsed.data.content)
        .then((response) => {
          res.status(200).json(response);
        })
        .catch((err: unknown) => next(mapChatError(err)));
    },
  );

  return router;
}
