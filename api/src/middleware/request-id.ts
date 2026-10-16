/**
 * M3 — Request ID middleware.
 *
 * Generates a unique request ID per request (UUID v4) if the client
 * did not supply one via `X-Request-Id`. The ID is attached to the
 * request and response headers for traceability, and is included in
 * all log output via the logger middleware.
 *
 * Per docs/SECURITY.md: logs record request ID, timings, status, and
 * safe error codes — not secrets or raw chat content.
 */
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Extracts a request ID from the `X-Request-Id` header, or generates a
 * new UUID v4 if absent. Attaches it to `req.id` and echoes it in the
 * response header.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.get(REQUEST_ID_HEADER);
  const id = existingId || randomUUID();

  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  next();
}
