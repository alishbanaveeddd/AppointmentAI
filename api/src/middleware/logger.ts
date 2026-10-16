/**
 * M3 — Structured logging middleware.
 *
 * Logs each request at completion with: HTTP method, path, status code,
 * response time, and request ID. Does NOT log request bodies, response
 * bodies, auth tokens, passwords, or any secret values.
 *
 * Per docs/SECURITY.md: logs record request ID, timings, status, and
 * safe error codes, not passwords, tokens, or unnecessary raw data.
 */
import type { Request, Response, NextFunction } from 'express';

// Simple structured logger — outputs JSON lines to stdout.
function log(level: string, message: string, data: Record<string, unknown> = {}) {
  const logLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  });
  // stdout for info, stderr for errors
  if (level === 'error') {
    console.error(logLine);
  } else {
    console.log(logLine);
  }
}

/**
 * Logging middleware. Call this AFTER requestIdMiddleware so that
 * `req.id` is available. Logs when the response finishes.
 */
export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    log('info', `${req.method} ${req.path}`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
