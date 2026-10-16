/**
 * M3 — Rate limiting middleware.
 *
 * A simple in-memory, fixed-window rate limiter. This is sufficient for
 * a single-process prototype. For multi-process deployments, a shared
 * store (e.g., Redis) would be needed.
 *
 * Per docs/SECURITY.md: rate limits on signup, login, chat, and booking
 * confirmation to mitigate brute-force and abuse.
 *
 * Configuration:
 * - `windowMs`: time window in milliseconds.
 * - `max`: maximum requests allowed per window per IP.
 */
import type { Request, Response, NextFunction } from 'express';

export interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

const store: RateLimitStore = {};

/**
 * Creates a rate limiter middleware factory.
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  /**
   * Cleans up expired entries from the store to prevent memory growth.
   * Called before each check.
   */
  function cleanup(now: number): void {
    for (const ip of Object.keys(store)) {
      if (store[ip].resetTime <= now) {
        delete store[ip];
      }
    }
  }

  /**
   * Checks the rate limit for a given IP. Returns the result.
   */
  function check(ip: string): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    const windowStart = now - opts.windowMs;
    const existing = store[ip];

    if (!existing || existing.resetTime <= windowStart) {
      // New window
      store[ip] = {
        count: 1,
        resetTime: now + opts.windowMs,
      };
      return {
        allowed: true,
        limit: opts.max,
        remaining: opts.max - 1,
        resetTime: store[ip].resetTime,
      };
    }

    // Within the current window
    const count = existing.count + 1;
    existing.count = count;

    if (count > opts.max) {
      // Over limit — do not increment count beyond max for remaining calc
      existing.count = opts.max;
      return {
        allowed: false,
        limit: opts.max,
        remaining: 0,
        resetTime: existing.resetTime,
      };
    }

    return {
      allowed: true,
      limit: opts.max,
      remaining: opts.max - count,
      resetTime: existing.resetTime,
    };
  }

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = check(ip);

    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(result.resetTime / 1000)),
    );

    if (!result.allowed) {
      // RFC 8593 style Retry-After header (seconds until window resets)
      const retryAfter = Math.ceil(
        (result.resetTime - Date.now()) / 1000,
      );
      res.setHeader('Retry-After', String(retryAfter));

      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Clears the in-memory rate limit store. Intended for test cleanup.
 */
export function clearRateLimitStore(): void {
  for (const ip of Object.keys(store)) {
    delete store[ip];
  }
}
