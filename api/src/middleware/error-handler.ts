/**
 * M3 — Error handler middleware.
 *
 * Catches unhandled errors and returns structured JSON error responses
 * per docs/API_CONTRACT.md. Never leaks stack traces or internal details
 * to the client. Includes the request ID for correlation.
 */
import type { ErrorRequestHandler } from 'express';

export type ConflictType =
  | 'slot_unavailable'
  | 'stale_proposal'
  | 'proposal_expired';

export interface ConflictDetail {
  type: ConflictType;
  proposalId: string | null;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly conflict?: ConflictDetail;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    conflict?: ConflictDetail,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.conflict = conflict;
  }
}

/**
 * Centralized Express error handler.
 * Must be registered LAST (after all routes) to catch everything.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req,
  res,
  _next,
): void => {
  const requestId = _req?.id;

    if (err instanceof ApiError) {
    const body: Record<string, unknown> = {
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    };
    if (err.conflict) {
      (body.error as Record<string, unknown>).conflict = err.conflict;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Log the actual error server-side (with safe details)
  if (err instanceof Error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: err.message,
        stack: err.stack,
        requestId,
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Unknown error',
        error: String(err),
        requestId,
      }),
    );
  }

  // Never expose internal details to the client
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred.',
      requestId,
    },
  });
};
