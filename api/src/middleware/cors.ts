/**
 * M3 — CORS and Origin validation middleware.
 *
 * Configures CORS with a restrictive allowlist: only the FRONTEND_URL
 * origin is permitted, with credentials enabled (HttpOnly cookies).
 *
 * Additionally validates the `Origin` (or `Referer`) header against the
 * allowlist on state-changing requests (POST, PUT, PATCH, DELETE) to
 * provide defense in depth beyond CORS.
 */
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { Env } from '../config/env';

export function createCorsMiddleware(env: Env) {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (e.g., mobile apps, curl, SSR).
      if (!origin) {
        callback(null, true);
        return;
      }

      // Only echo the approved frontend origin.
      if (origin === env.FRONTEND_URL) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    maxAge: 86400, // 24 hours for preflight cache
  });
}

/**
 * Middleware that validates the Origin header on state-changing requests.
 * For non-browser clients (no Origin), requests are allowed through.
 * For browser clients, the Origin must match the allowed origin.
 */
export function createOriginCheckMiddleware(env: Env) {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  return function originCheckMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!stateChangingMethods.includes(req.method)) {
      next();
      return;
    }

    const origin = req.get('origin') || req.get('referer');

    if (!origin) {
      // No Origin header — non-browser client; allow.
      next();
      return;
    }

    // Compare origin URL against FRONTEND_URL.
    try {
      const originUrl = new URL(origin);
      const allowedUrl = new URL(env.FRONTEND_URL);

      if (originUrl.origin === allowedUrl.origin) {
        next();
        return;
      }
    } catch {
      // Invalid URL format — reject.
    }

    res.status(403).json({
      error: {
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Request origin is not permitted.',
        requestId: req.id,
      },
    });
  };
}
