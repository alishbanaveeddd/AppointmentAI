/**
 * M4 — Appointment scheduling routes.
 *
 * Endpoints (all require authentication per docs/API_CONTRACT.md):
 * - POST   /appointments/proposals           → create a booking proposal  (D-008, D-009)
 * - GET    /appointments/proposals/:id         → retrieve a pending proposal
 * - POST   /appointments/proposals/:id/confirm → confirm → appointment    (D-009, D-010)
 * - GET    /appointments                       → list current user's appointments
 * - GET    /appointments/:id                   → retrieve an owned appointment
 * - PATCH  /appointments/:id/cancel            → cancel an eligible appointment (D-012)
 *
 * Per docs/ARCHITECTURE.md: routes are thin — business logic lives in
 * services. Route handlers parse input, call the service, and map
 * domain errors to structured ApiError responses.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createProposalSchema } from '../schemas/appointment';
import { createAppointmentService, type AppointmentService } from '../services/appointment';
import {
  AppointmentNotFoundError,
  AppointmentError,
  ProposalError,
  ProposalNotFoundError,
  ProposalExpiredError,
  ProposalInvalidatedError,
  BusinessHoursViolationError,
  PastAppointmentError,
  InvalidDurationError,
  SlotConflictError,
  NotEligibleForCancellationError,
} from '../services/appointment';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error-handler';

export interface AppointmentRoutesDeps {
  prisma: PrismaClient;
  now?: () => Date;
  /** M7: shared appointment service (created once in app.ts, shared with chat). */
  appointmentService?: AppointmentService;
}

/**
 * Maps a service-domain error to a structured ApiError.
 * - 400 for invalid input
 * - 404 for not found / not owned
 * - 409 for conflicts (slot unavailable, proposal expired/invalidated)
 * - 422 for business-hours / past-date violations
 */
function mapServiceError(err: unknown, proposalId?: string): ApiError {
  if (err instanceof ProposalNotFoundError) {
    return new ApiError(404, 'NOT_FOUND', err.message);
  }
  if (err instanceof AppointmentNotFoundError) {
    return new ApiError(404, 'NOT_FOUND', err.message);
  }
  if (err instanceof BusinessHoursViolationError) {
    return new ApiError(422, 'VALIDATION_ERROR', err.message);
  }
  if (err instanceof PastAppointmentError) {
    return new ApiError(422, 'VALIDATION_ERROR', err.message);
  }
  if (err instanceof InvalidDurationError) {
    return new ApiError(400, 'VALIDATION_ERROR', err.message);
  }
  if (err instanceof SlotConflictError) {
    return new ApiError(409, 'CONFLICT', err.message, {
      type: 'slot_unavailable',
      proposalId: proposalId ?? null,
    });
  }
  if (err instanceof ProposalExpiredError) {
    return new ApiError(409, 'CONFLICT', err.message, {
      type: 'proposal_expired',
      proposalId: proposalId ?? null,
    });
  }
  if (err instanceof ProposalInvalidatedError) {
    return new ApiError(409, 'CONFLICT', err.message, {
      type: 'stale_proposal',
      proposalId: proposalId ?? null,
    });
  }
  if (err instanceof NotEligibleForCancellationError) {
    return new ApiError(409, 'CONFLICT', err.message);
  }
  // Catch-all for unexpected AppointmentError / ProposalError
  if (err instanceof AppointmentError || err instanceof ProposalError) {
    return new ApiError(400, 'BAD_REQUEST', err.message);
  }
  return err as ApiError;
}

export function createAppointmentRouter(deps: AppointmentRoutesDeps) {
  const { prisma, now, appointmentService: injectedService } = deps;
  const service = injectedService ?? createAppointmentService({ prisma, now });
  const router = Router();

  // All appointment endpoints require authentication.
  router.use(requireAuth);

  // POST /appointments/proposals — create a booking proposal
  router.post(
    '/proposals',
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = createProposalSchema.safeParse(req.body);

      if (!parsed.success) {
        next(
          new ApiError(
            400,
            'VALIDATION_ERROR',
            parsed.error.issues[0].message,
          ),
        );
        return;
      }

      const userId = (req as AuthenticatedRequest).userId;

      service
        .createProposal(userId, parsed.data)
        .then((proposal) => {
          res.status(201).json({ proposal });
        })
        .catch((err: unknown) => next(mapServiceError(err)));
    },
  );

  // GET /appointments/proposals/:proposalId — retrieve a proposal
  router.get(
    '/proposals/:proposalId',
    (req: Request, res: Response, next: NextFunction) => {
      const { proposalId } = req.params as { proposalId: string };
      const userId = (req as AuthenticatedRequest).userId;

      service
        .getProposal(userId, proposalId)
        .then((proposal) => {
          res.status(200).json({ proposal });
        })
        .catch((err: unknown) =>
          next(mapServiceError(err, proposalId)),
        );
    },
  );

  // POST /appointments/proposals/:proposalId/confirm — confirm → appointment
  router.post(
    '/proposals/:proposalId/confirm',
    (req: Request, res: Response, next: NextFunction) => {
      const { proposalId } = req.params as { proposalId: string };
      const userId = (req as AuthenticatedRequest).userId;

      service
        .confirmProposal(userId, proposalId)
        .then(({ appointment, isNew }) => {
          res.status(isNew ? 201 : 200).json({ appointment, isNew });
        })
        .catch((err: unknown) =>
          next(mapServiceError(err, proposalId)),
        );
    },
  );

  // GET /appointments — list current user's appointments
  router.get(
    '/',
    (req: Request, res: Response, next: NextFunction) => {
      const userId = (req as AuthenticatedRequest).userId;

      service
        .listAppointments(userId)
        .then((appointments) => {
          res.status(200).json({ appointments });
        })
        .catch(next);
    },
  );

  // GET /appointments/:appointmentId — retrieve an owned appointment
  router.get(
    '/:appointmentId',
    (req: Request, res: Response, next: NextFunction) => {
      const { appointmentId } = req.params as { appointmentId: string };
      const userId = (req as AuthenticatedRequest).userId;

      service
        .getAppointment(userId, appointmentId)
        .then((appointment) => {
          res.status(200).json({ appointment });
        })
        .catch((err: unknown) => next(mapServiceError(err)));
    },
  );

  // PATCH /appointments/:appointmentId/cancel — cancel an eligible appointment
  router.patch(
    '/:appointmentId/cancel',
    (req: Request, res: Response, next: NextFunction) => {
      const { appointmentId } = req.params as { appointmentId: string };
      const userId = (req as AuthenticatedRequest).userId;

      service
        .cancelAppointment(userId, appointmentId)
        .then(({ appointment }) => {
          res.status(200).json({ appointment });
        })
        .catch((err: unknown) => next(mapServiceError(err)));
    },
  );

  return router;
}



