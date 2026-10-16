/**
 * M3 — Auth middleware.
 *
 * Verifies the JWT from the `auth_token` cookie and attaches the
 * authenticated user's ID to `req.userId`. The user ID is derived from
 * the verified token — never trusted from the client body or headers.
 *
 * Protected routes are wrapped with `requireAuth`. Unauthenticated
 * requests receive HTTP 401 with a structured error body.
 *
 * Per docs/SECURITY.md: "Never trust client-supplied user ID; derive
 * from authenticated principal."
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt';
import { validateEnv } from '../config/env';

const env = validateEnv();

export const AUTH_COOKIE_NAME = 'auth_token';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

/**
 * Middleware that requires a valid JWT in the auth cookie.
 * On success, attaches `userId` to the request and calls `next()`.
 * On failure, responds with 401 and a structured error body.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
        requestId: req.id,
      },
    });
    return;
  }

  try {
    const payload = verifyJwt(token, env);
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired token.',
        requestId: req.id,
      },
    });
  }
}
