/**
 * M3 — Authentication routes.
 *
 * Endpoints:
 * - POST /auth/signup — register a new user, returns user summary + sets JWT cookie
 * - POST /auth/login  — authenticate, returns user summary + sets JWT cookie
 * - POST /auth/logout — clears JWT cookie
 * - GET  /auth/me    — returns current user summary (requires auth)
 *
 * Per docs/API_CONTRACT.md:
 * - Signup returns a sanitized user summary (id, name, email) — never the password hash.
 * - Login failures return a generic "Invalid email or password" message.
 * - The JWT is set ONLY in an HttpOnly cookie, never in the response body.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env';
import { signupSchema, loginSchema } from '../schemas/auth';
import { createAuthService } from '../services/auth';
import { EmailAlreadyInUseError, InvalidCredentialsError } from '../services/auth';
import { AUTH_COOKIE_NAME, requireAuth } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';
import { createRateLimiter } from '../middleware/rate-limiter';

export interface AuthRoutesDeps {
  prisma: PrismaClient;
  env: Env;
  bcryptRounds?: number;
}

// Rate limiters: 5 signups per 15 min, 10 logins per 15 min per IP.
const signupRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
});
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

/**
 * Builds a cookie options object appropriate for the current environment.
 * In development (HTTP localhost), Secure is false.
 * In production (HTTPS), Secure is true.
 */
function getCookieOptions(env: Env, maxAgeSeconds: number = 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function createAuthRouter(deps: AuthRoutesDeps) {
  const { prisma, env, bcryptRounds } = deps;
  const authService = createAuthService({ prisma, env, bcryptRounds });
  const router = Router();

  // POST /auth/signup
  router.post(
    '/signup',
    signupRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = signupSchema.safeParse(req.body);

      if (!parsed.success) {
        next(new ApiError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message));
        return;
      }

      authService
        .signup(parsed.data.name, parsed.data.email, parsed.data.password)
        .then(({ user, token }) => {
          // Set JWT in HttpOnly cookie — never in response body.
          res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(env));

          res.status(201).json({
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
            },
          });
        })
                .catch((err: unknown) => {
          if (err instanceof EmailAlreadyInUseError) {
            next(new ApiError(409, 'CONFLICT', err.message));
            return;
          }
          next(err);
        });
    },
  );

  // POST /auth/login
  router.post(
    '/login',
    loginRateLimiter,
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        next(new ApiError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message));
        return;
      }

      authService
        .login(parsed.data.email, parsed.data.password)
        .then(({ user, token }) => {
          res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(env));

          res.status(200).json({
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
            },
          });
        })
                .catch((err: unknown) => {
          if (err instanceof InvalidCredentialsError) {
            // Generic message — no account enumeration.
            next(new ApiError(401, 'UNAUTHENTICATED', err.message));
            return;
          }
          next(err);
        });
    },
  );

    // POST /auth/logout
  router.post(
    '/logout',
    (_req: Request, res: Response) => {
      res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions(env, 0));
      res.status(204).send();
    },
  );

  // GET /auth/me — requires authentication
  router.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as { userId?: string }).userId;

    prisma.user
      .findUnique({
        where: { id: userId as string },
        select: { id: true, name: true, email: true },
      })
      .then((user) => {
        if (!user) {
          next(new ApiError(404, 'NOT_FOUND', 'User not found.'));
          return;
        }
        res.status(200).json({ user });
      })
      .catch(next);
  });

  return router;
}
