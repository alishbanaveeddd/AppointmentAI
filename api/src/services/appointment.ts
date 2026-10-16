/**
 * M4 — Appointment scheduling service.
 *
 * Encapsulates all appointment business logic: proposal lifecycle (create,
 * retrieve, confirm), appointment listing/retrieval, and cancellation.
 *
 * Per docs/API_CONTRACT.md D-008–D-024:
 * - Proposals are user-scoped; only the owner can confirm/cancel.
 * - Proposals expire 15 min after creation unless explicitly confirmed (D-009).
 * - Confirmation is idempotent: repeated confirms return the same appointment (D-009).
 * - Business hours enforced server-side (Mon–Fri 9–5 Asia/Karachi, D-008).
 * - Slot overlaps prevented via query check + PostgreSQL exclusion constraint (D-010).
 * - Cancellation only for confirmed appointments ≥ 2 h before start (D-012).
 *
 * The service throws domain-specific errors. The route layer maps these
 * to structured HTTP responses (ApiError).
 */
import type { PrismaClient } from '@prisma/client';
import {
  APPOINTMENT_DURATION_MS,
  CANCELLATION_CUTOFF_MS,
  PROPOSAL_TTL_MS,
  isWithinBusinessHours,
} from '../config/booking';

/* ------------------------------------------------------------------ *
 * Domain error classes
 * ------------------------------------------------------------------ */

export class AppointmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentError';
  }
}

export class ProposalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalError';
  }
}

export class BusinessHoursViolationError extends AppointmentError {
  constructor() {
    super(
      'The requested time falls outside business hours ' +
        '(Monday–Friday, 9:00 AM–5:00 PM Asia/Karachi).',
    );
    this.name = 'BusinessHoursViolationError';
  }
}

export class PastAppointmentError extends AppointmentError {
  constructor() {
    super('Cannot schedule an appointment in the past.');
    this.name = 'PastAppointmentError';
  }
}

export class InvalidDurationError extends AppointmentError {
  constructor() {
    super('Appointment duration must be exactly 30 minutes.');
    this.name = 'InvalidDurationError';
  }
}

export class SlotConflictError extends AppointmentError {
  constructor() {
    super('The selected time slot is no longer available.');
    this.name = 'SlotConflictError';
  }
}

export class AppointmentNotFoundError extends AppointmentError {
  constructor() {
    super('Appointment not found.');
    this.name = 'AppointmentNotFoundError';
  }
}

export class NotEligibleForCancellationError extends AppointmentError {
  constructor(message?: string) {
    super(message ?? 'This appointment cannot be cancelled at this time.');
    this.name = 'NotEligibleForCancellationError';
  }
}

export class ProposalNotFoundError extends ProposalError {
  constructor() {
    super('Proposal not found.');
    this.name = 'ProposalNotFoundError';
  }
}

export class ProposalExpiredError extends ProposalError {
  constructor() {
    super('This proposal has expired.');
    this.name = 'ProposalExpiredError';
  }
}

export class ProposalInvalidatedError extends ProposalError {
  constructor() {
    super('This proposal is no longer valid.');
    this.name = 'ProposalInvalidatedError';
  }
}

/* ------------------------------------------------------------------ *
 * Return types
 * ------------------------------------------------------------------ */

export interface ProposalResult {
  proposalId: string;
  userId: string;
  service: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  durationMinutes: number;
  expiresAt: Date;
  status: string;
}

export interface AppointmentSummary {
  id: string;
  service: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

export interface ConfirmationResult {
  appointment: AppointmentSummary;
  isNew: boolean;
}

export interface CancellationResult {
  appointment: AppointmentSummary;
}

export interface AppointmentServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
}

/**
 * The service interface returned by `createAppointmentService`.
 * M7: Shared between the appointment router and the chat service so that
 * AI-driven booking flows reuse the same business-logic layer.
 */
export type AppointmentService = ReturnType<typeof createAppointmentService>;

/* ------------------------------------------------------------------ *
 * Factory
 * ------------------------------------------------------------------ */

/**
 * Creates an AppointmentService instance.
 *
 * The `now` dependency is injected for testability (proposal expiry
 * tests can control the clock).
 */
export function createAppointmentService({
  prisma,
  now = () => new Date(),
}: AppointmentServiceDeps) {
  /** Validate that a proposed time slot satisfies all business rules. */
  function validateSlot(startsAt: Date, endsAt: Date): void {
    // Ends after starts
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new InvalidDurationError();
    }

    // Duration must be exactly 30 minutes
    const diffMs = endsAt.getTime() - startsAt.getTime();
    if (diffMs !== APPOINTMENT_DURATION_MS) {
      throw new InvalidDurationError();
    }

    // No past bookings (exclusive: a slot starting exactly now is acceptable)
    if (startsAt.getTime() < now().getTime()) {
      throw new PastAppointmentError();
    }

    // Business hours (checked in Asia/Karachi)
    if (!isWithinBusinessHours(startsAt)) {
      throw new BusinessHoursViolationError();
    }
  }

  /**
   * Safely executes a findUnique query, treating invalid UUID format
   * errors (Prisma P2023) as "not found" so the caller can uniformly
   * handle both non-existent records and malformed IDs.
   */
  async function safeFindUnique<T>(
    query: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      return await query();
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2023'
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Creates a booking proposal.
   *
   * Validates the requested slot against business rules (D-008) and
   * sets an automatic 15-minute expiry (D-009).
   * Slot conflicts are checked at confirmation time (D-010).
   *
   * Throws: PastAppointmentError, InvalidDurationError,
   *         BusinessHoursViolationError.
   */
  async function createProposal(
    userId: string,
    input: {
      service: string;
      startsAt: Date;
      endsAt: Date;
      timezone: string;
      durationMinutes: number;
    },
    ): Promise<ProposalResult> {
    validateSlot(input.startsAt, input.endsAt);

    const expiresAt = new Date(now().getTime() + PROPOSAL_TTL_MS);

    const proposal = await prisma.bookingProposal.create({
      data: {
        userId,
        service: input.service,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone,
        durationMinutes: input.durationMinutes,
        expiresAt,
        status: 'pending',
      },
    });

    return {
      proposalId: proposal.proposalId,
      userId: proposal.userId,
      service: proposal.service,
      startsAt: proposal.startsAt,
      endsAt: proposal.endsAt,
      timezone: proposal.timezone,
      durationMinutes: proposal.durationMinutes,
      expiresAt: proposal.expiresAt,
      status: proposal.status,
    };
  }

  /**
   * Retrieves a proposal by its UUID (user-scoped).
   */
    async function getProposal(
    userId: string,
    proposalId: string,
  ): Promise<ProposalResult> {
    const proposal = await safeFindUnique(() =>
      prisma.bookingProposal.findUnique({
        where: { proposalId },
      }),
    );

    if (!proposal || proposal.userId !== userId) {
      throw new ProposalNotFoundError();
    }

    // Auto-expire if past TTL while still pending
    if (proposal.status === 'pending' && proposal.expiresAt <= now()) {
      await prisma.bookingProposal.update({
        where: { proposalId: proposal.proposalId },
        data: { status: 'expired' },
      });
      throw new ProposalExpiredError();
    }

        if (proposal.status === 'invalidated') {
      throw new ProposalInvalidatedError();
    }

    return {
      proposalId: proposal.proposalId,
      userId: proposal.userId,
      service: proposal.service,
      startsAt: proposal.startsAt,
      endsAt: proposal.endsAt,
      timezone: proposal.timezone,
      durationMinutes: proposal.durationMinutes,
      expiresAt: proposal.expiresAt,
      status: proposal.status,
    };
  }

  /**
   * Confirms a proposal, converting it into a confirmed appointment.
   *
   * Idempotent: repeated confirms return the same appointment (D-009).
   * Transaction prevents race conditions; exclusion constraint is the
   * final safety net (D-010).
   */
    async function confirmProposal(
    userId: string,
    proposalId: string,
  ): Promise<ConfirmationResult> {
    const proposal = await safeFindUnique(() =>
      prisma.bookingProposal.findUnique({
        where: { proposalId },
        include: { appointment: true },
      }),
    );

    if (!proposal || proposal.userId !== userId) {
      throw new ProposalNotFoundError();
    }

    // Idempotency: already confirmed
    if (proposal.status === 'confirmed' && proposal.appointment) {
      return {
        appointment: {
          id: proposal.appointment.id,
          service: proposal.appointment.service,
          startsAt: proposal.appointment.startsAt,
          endsAt: proposal.appointment.endsAt,
          status: proposal.appointment.status,
        },
        isNew: false,
      };
    }

    // If invalidated, cannot confirm
    if (proposal.status === 'invalidated') {
      throw new ProposalInvalidatedError();
    }

    // Check expiry
    if (proposal.status === 'pending' && proposal.expiresAt <= now()) {
      await prisma.bookingProposal.update({
        where: { proposalId: proposal.proposalId },
        data: { status: 'expired' },
      });
      throw new ProposalExpiredError();
    }

    // Re-validate all business rules
    validateSlot(proposal.startsAt, proposal.endsAt);

    // Transaction: check slot availability and create appointment atomically
    try {
      const appointment = await prisma.$transaction(async (tx) => {
        const slotTaken = await tx.appointment.findFirst({
          where: {
            status: 'confirmed',
            startsAt: { lt: proposal.endsAt },
            endsAt: { gt: proposal.startsAt },
          },
          select: { id: true },
        });

        if (slotTaken) {
          throw new SlotConflictError();
        }

        const newAppointment = await tx.appointment.create({
          data: {
            userId: proposal.userId,
            service: proposal.service,
            startsAt: proposal.startsAt,
            endsAt: proposal.endsAt,
            status: 'confirmed',
          },
        });

        await tx.bookingProposal.update({
          where: { proposalId: proposal.proposalId },
          data: {
            status: 'confirmed',
            appointmentId: newAppointment.id,
          },
        });

        return newAppointment;
      });

      return {
        appointment: {
          id: appointment.id,
          service: appointment.service,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          status: appointment.status,
        },
        isNew: true,
      };
    } catch (err) {
      if (err instanceof SlotConflictError) throw err;
      // The exclusion constraint `no_overlapping_confirmed_appointments` is the
      // final safety net for races that slip past the findFirst check above.
      // Under PostgreSQL ReadCommitted isolation, two concurrent transactions
      // can both pass findFirst and then race on INSERT. The database rejects
      // the second with SQLSTATE 23P01 (exclusion_violation), which Prisma
      // surfaces as PrismaClientUnknownRequestError — this error class has no
      // `.code` property, so we match on the constraint name in the message.
      if (
        err instanceof Error &&
        err.message.includes('no_overlapping_confirmed_appointments')
      ) {
        throw new SlotConflictError();
      }
      throw err;
    }
  }

  /**
   * Lists all appointments for the requesting user, ordered by start time.
   */
  async function listAppointments(
    userId: string,
  ): Promise<AppointmentSummary[]> {
    const appointments = await prisma.appointment.findMany({
      where: { userId },
      orderBy: { startsAt: 'desc' },
    });

    return appointments.map((a) => ({
      id: a.id,
      service: a.service,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      status: a.status,
    }));
  }

  /**
   * Retrieves a single appointment by its cuid ID (user-scoped).
   * Throws AppointmentNotFoundError if not found or not owned.
   */
  async function getAppointment(
    userId: string,
    appointmentId: string,
  ): Promise<AppointmentSummary> {
    const appointment = await safeFindUnique(() =>
      prisma.appointment.findUnique({
        where: { id: appointmentId },
      }),
    );

    if (!appointment || appointment.userId !== userId) {
      throw new AppointmentNotFoundError();
    }

    return {
      id: appointment.id,
      service: appointment.service,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
    };
  }

  /**
   * Cancels a confirmed appointment.
   *
   * Only confirmed appointments can be cancelled, and only if the
   * cancellation is at least 2 hours before the appointment start (D-012).
   *
   * Throws: AppointmentNotFoundError, NotEligibleForCancellationError.
   */
  async function cancelAppointment(
    userId: string,
    appointmentId: string,
  ): Promise<CancellationResult> {
    const appointment = await safeFindUnique(() =>
      prisma.appointment.findUnique({
        where: { id: appointmentId },
      }),
    );

    if (!appointment || appointment.userId !== userId) {
      throw new AppointmentNotFoundError();
    }

    // Only confirmed appointments can be cancelled
    if (appointment.status !== 'confirmed') {
      throw new NotEligibleForCancellationError(
        'Only confirmed appointments can be cancelled.',
      );
    }

    // Must cancel at least 2 hours before start
    const timeUntilStart =
      appointment.startsAt.getTime() - now().getTime();
    if (timeUntilStart < CANCELLATION_CUTOFF_MS) {
      throw new NotEligibleForCancellationError(
        'Cancellations must be made at least 2 hours before the appointment start time.',
      );
    }

    const cancelled = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'cancelled' },
    });

    return {
      appointment: {
        id: cancelled.id,
        service: cancelled.service,
        startsAt: cancelled.startsAt,
        endsAt: cancelled.endsAt,
        status: cancelled.status,
      },
    };
  }

  return {
    createProposal,
    getProposal,
    confirmProposal,
    listAppointments,
    getAppointment,
    cancelAppointment,
  };
}
