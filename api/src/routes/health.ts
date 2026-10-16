/**
 * Health check route handler.
 *
 * GET /api/health — liveness only.
 * Does NOT expose secrets or internal configuration (per docs/API_CONTRACT.md).
 */
import type { Request, Response } from 'express';

export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
  });
}
