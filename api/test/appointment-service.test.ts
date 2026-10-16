/**
 * M4 — Appointment scheduling service tests.
 *
 * Tests the service layer (createAppointmentService) directly:
 * - Proposal creation (valid + invalid inputs, business-hours, past dates)
 * - Proposal expiry after TTL
 * - Proposal retrieval (pending / expired / not-owned)
 * - Confirmation idempotency
 * - Slot conflicts (same-slot and overlapping)
 * - Appointment listing and retrieval
 * - Cancellation rules (2-hour cutoff, confirmed-only, not-found / not-owned)
 *
 * The `now` dependency is injected with a controllable clock so expiry and
 * cancellation-cutoff tests do not depend on the real wall-clock time.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createAppointmentService,
  ProposalNotFoundError,
  ProposalExpiredError,
  BusinessHoursViolationError,
  PastAppointmentError,
  InvalidDurationError,
  SlotConflictError,
  AppointmentNotFoundError,
  NotEligibleForCancellationError,
  ProposalInvalidatedError,
} from '../src/services/appointment';
import { BOOKING_TIMEZONE, PROPOSAL_TTL_MS } from '../src/config/booking';

const prisma = new PrismaClient({ log: ['error'] });

// Base "now" – a Monday 10:00 AM in Asia/Karachi (UTC+5)
const BASE_DATE = new Date('2026-10-19T05:00:00.000Z'); // → 10:00 Mon Karachi

let clock: Date;

function createServiceWithClock(currentTime: Date) {
  clock = currentTime;
  return createAppointmentService({
    prisma,
    now: () => clock,
  });
}

/** Returns a Karachi-local date for given weekday/hour/minute (all integers). */
function karachiDate(weekday: number, hour: number, minute = 0): Date {
  // BASE_DATE = Monday Oct 19 2026 10:00 Karachi (UTC+5).
  const base = new Date(BASE_DATE);
  const diff = (weekday - 1) * 24 * 60 * 60 * 1000; // weekday: 0=Sun..6=Sat; Mon=1
  return new Date(base.getTime() + diff + (hour - 10) * 60 * 60 * 1000 + minute * 60 * 1000);
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;',
  );
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createUser(email: string, name = 'Test User') {
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash: 'hash',
    },
  });
}

describe('Appointment service — createProposal', () => {
  it('creates a proposal for a valid Monday 10:00 slot', async () => {
    const user = await createUser('create1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);  // Monday 10:00 Karachi
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const result = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    expect(result.proposalId).toBeDefined();
    expect(result.userId).toBe(user.id);
    expect(result.service).toBe('Consultation');
    expect(result.timezone).toBe(BOOKING_TIMEZONE);
    expect(result.durationMinutes).toBe(30);
    expect(result.status).toBe('pending');
    expect(result.expiresAt.getTime() - clock.getTime()).toBe(PROPOSAL_TTL_MS);
  });

  it('throws PastAppointmentError for a slot in the past', async () => {
    const user = await createUser('create2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 8);  // 2 hours before "now"
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    await expect(
      svc.createProposal(user.id, {
        service: 'Consultation',
        startsAt,
        endsAt,
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(PastAppointmentError);
  });

  it('throws BusinessHoursViolationError for Saturday', async () => {
    const user = await createUser('create3@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(6, 10);  // Saturday 10:00
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    await expect(
      svc.createProposal(user.id, {
        service: 'Consultation',
        startsAt,
        endsAt,
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(BusinessHoursViolationError);
  });

  it('throws BusinessHoursViolationError for 5 PM slot', async () => {
    const user = await createUser('create4@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 17); // Monday 5 PM
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    await expect(
      svc.createProposal(user.id, {
        service: 'Consultation',
        startsAt,
        endsAt,
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(BusinessHoursViolationError);
  });

  it('throws BusinessHoursViolationError for 8 AM slot (before 9 AM)', async () => {
    const user = await createUser('create5@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(2, 8); // Tuesday 8 AM (future but before 9 AM)
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    await expect(
      svc.createProposal(user.id, {
        service: 'Consultation',
        startsAt,
        endsAt,
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(BusinessHoursViolationError);
  });

  it('throws InvalidDurationError when endsAt - startsAt != 30 min', async () => {
    const user = await createUser('create6@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000); // 45 min

    await expect(
      svc.createProposal(user.id, {
        service: 'Consultation',
        startsAt,
        endsAt,
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(InvalidDurationError);
  });

  it('throws SlotConflictError when the slot overlaps a confirmed appointment', async () => {
    const user = await createUser('create7a@example.com');
    const user2 = await createUser('create7b@example.com', 'User B');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    await svc.confirmProposal(user.id, proposal.proposalId);

    // createProposal succeeds (no conflict check at creation time);
    // the conflict is caught when confirming the second proposal.
    const proposal2 = await svc.createProposal(user2.id, {
      service: 'Consultation 2',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    await expect(
      svc.confirmProposal(user2.id, proposal2.proposalId),
    ).rejects.toThrow(SlotConflictError);
  });
});

describe('Appointment service — getProposal', () => {
  it('retrieves a pending proposal by ID', async () => {
    const user = await createUser('getprop1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    const result = await svc.getProposal(user.id, proposal.proposalId);
    expect(result.proposalId).toBe(proposal.proposalId);
    expect(result.status).toBe('pending');
  });

  it('throws ProposalExpiredError when proposal is past TTL (auto-transitions to expired)', async () => {
    const user = await createUser('getprop2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    // Advance clock past TTL
    clock = new Date(clock.getTime() + PROPOSAL_TTL_MS + 1000);

    await expect(svc.getProposal(user.id, proposal.proposalId)).rejects.toThrow(
      ProposalExpiredError,
    );

    // Verify the proposal status was updated to 'expired'
    const updated = await prisma.bookingProposal.findUnique({
      where: { proposalId: proposal.proposalId },
    });
    expect(updated?.status).toBe('expired');
  });

  it('throws ProposalNotFoundError for non-existent proposal', async () => {
    const user = await createUser('getprop3@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    await expect(
      svc.getProposal(user.id, 'non-existent-id'),
    ).rejects.toThrow(ProposalNotFoundError);
  });

  it('throws ProposalNotFoundError if another user owns the proposal', async () => {
    const user1 = await createUser('getprop4a@example.com');
    const user2 = await createUser('getprop4b@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user1.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    await expect(svc.getProposal(user2.id, proposal.proposalId)).rejects.toThrow(
      ProposalNotFoundError,
    );
  });
});

describe('Appointment service — confirmProposal', () => {
  it('creates a confirmed appointment and marks proposal as confirmed', async () => {
    const user = await createUser('confirm1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    const result = await svc.confirmProposal(user.id, proposal.proposalId);

    expect(result.isNew).toBe(true);
    expect(result.appointment).toBeDefined();
    expect(result.appointment.service).toBe('Consultation');
    expect(result.appointment.status).toBe('confirmed');
  });

  it('is idempotent — repeated confirms return the same appointment', async () => {
    const user = await createUser('confirm2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    const first = await svc.confirmProposal(user.id, proposal.proposalId);
    const second = await svc.confirmProposal(user.id, proposal.proposalId);

    expect(second.isNew).toBe(false);
    expect(second.appointment.id).toBe(first.appointment.id);
    expect(second.appointment.id).toBeDefined();
  });

  it('throws ProposalExpiredError when confirming an expired proposal', async () => {
    const user = await createUser('confirm3@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    clock = new Date(clock.getTime() + PROPOSAL_TTL_MS + 1000);

    await expect(svc.confirmProposal(user.id, proposal.proposalId)).rejects.toThrow(
      ProposalExpiredError,
    );
  });

  it('throws SlotConflictError when confirming a proposal whose slot is now taken', async () => {
    const user1 = await createUser('confirm4a@example.com');
    const user2 = await createUser('confirm4b@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal1 = await svc.createProposal(user1.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    await svc.confirmProposal(user1.id, proposal1.proposalId);

    const proposal2 = await svc.createProposal(user2.id, {
      service: 'Consultation 2',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    await expect(svc.confirmProposal(user2.id, proposal2.proposalId)).rejects.toThrow(
      SlotConflictError,
    );
  });

  it('throws SlotConflictError when two concurrent confirmations race past findFirst', async () => {
    // This test exercises the PostgreSQL exclusion constraint path:
    // both transactions pass the in-transaction findFirst check (neither has
    // committed yet), then race on INSERT. The second INSERT is rejected by
    // the exclusion constraint (SQLSTATE 23P01) and translated to SlotConflictError.
    // Under ReadCommitted isolation, timing may cause either the findFirst check
    // or the exclusion constraint to fire — both are valid; the assertion is that
    // exactly one appointment results.
    const user1 = await createUser('concurrent1@example.com');
    const user2 = await createUser('concurrent2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal1 = await svc.createProposal(user1.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    const proposal2 = await svc.createProposal(user2.id, {
      service: 'Consultation 2',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    const results = await Promise.allSettled([
      svc.confirmProposal(user1.id, proposal1.proposalId),
      svc.confirmProposal(user2.id, proposal2.proposalId),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled',
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    // One must succeed, one must fail
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(SlotConflictError);

    // Only one appointment exists for this time slot
    const count = await prisma.appointment.count({
      where: { startsAt, endsAt },
    });
    expect(count).toBe(1);
  });

  it('throws ProposalInvalidatedError when confirming an invalidated proposal', async () => {
    const user = await createUser('confirm-invalidated@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    // Directly mark the proposal as invalidated (simulating admin invalidation)
    await prisma.bookingProposal.update({
      where: { proposalId: proposal.proposalId },
      data: { status: 'invalidated' },
    });

    await expect(
      svc.confirmProposal(user.id, proposal.proposalId),
    ).rejects.toThrow(ProposalInvalidatedError);

    // Confirm no appointment was created
    const count = await prisma.appointment.count({
      where: { startsAt, endsAt },
    });
    expect(count).toBe(0);
  });

  it('throws ProposalNotFoundError when confirming a non-existent proposal', async () => {
    const user = await createUser('confirm5@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    await expect(svc.confirmProposal(user.id, 'no-such-id')).rejects.toThrow(
      ProposalNotFoundError,
    );
  });

  it('throws ProposalNotFoundError when another user tries to confirm', async () => {
    const user1 = await createUser('confirm6a@example.com');
    const user2 = await createUser('confirm6b@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user1.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    await expect(svc.confirmProposal(user2.id, proposal.proposalId)).rejects.toThrow(
      ProposalNotFoundError,
    );
  });
});

describe('Appointment service — listAppointments', () => {
  it('returns an empty list when the user has no appointments', async () => {
    const user = await createUser('list1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const result = await svc.listAppointments(user.id);
    expect(result).toEqual([]);
  });

  it('lists all confirmed appointments for the user', async () => {
    const user = await createUser('list2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    for (let i = 0; i < 2; i++) {
      const startsAt = karachiDate(1, 10 + i);
      const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
      const proposal = await svc.createProposal(user.id, {
        service: `Consultation ${i}`,
        startsAt,
        endsAt,
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      });
      await svc.confirmProposal(user.id, proposal.proposalId);
    }

    const result = await svc.listAppointments(user.id);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.service)).toContain('Consultation 0');
    expect(result.map((a) => a.service)).toContain('Consultation 1');
  });
});

describe('Appointment service — getAppointment', () => {
  it('retrieves a confirmed appointment by ID', async () => {
    const user = await createUser('getappt1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    const { appointment } = await svc.confirmProposal(user.id, proposal.proposalId);

    const result = await svc.getAppointment(user.id, appointment.id);
    expect(result.id).toBe(appointment.id);
    expect(result.service).toBe('Consultation');
    expect(result.status).toBe('confirmed');
  });

  it('throws AppointmentNotFoundError for non-existent appointment', async () => {
    const user = await createUser('getappt2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    await expect(svc.getAppointment(user.id, 'no-such-id')).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });

  it('throws AppointmentNotFoundError when another user requests an appointment', async () => {
    const user1 = await createUser('getappt3a@example.com');
    const user2 = await createUser('getappt3b@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const proposal = await svc.createProposal(user1.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    const { appointment } = await svc.confirmProposal(user1.id, proposal.proposalId);

    await expect(svc.getAppointment(user2.id, appointment.id)).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });
});

describe('Appointment service — cancelAppointment', () => {
  it('cancels a confirmed appointment (>= 2h before start)', async () => {
    const user = await createUser('cancel1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(2, 14);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    const { appointment } = await svc.confirmProposal(user.id, proposal.proposalId);

    const result = await svc.cancelAppointment(user.id, appointment.id);
    expect(result.appointment.status).toBe('cancelled');

    const cancelled = await prisma.appointment.findUnique({
      where: { id: appointment.id },
    });
    expect(cancelled?.status).toBe('cancelled');
  });

  it('throws NotEligibleForCancellationError when < 2h before start', async () => {
    const user = await createUser('cancel2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 11);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    const { appointment } = await svc.confirmProposal(user.id, proposal.proposalId);

    await expect(svc.cancelAppointment(user.id, appointment.id)).rejects.toThrow(
      NotEligibleForCancellationError,
    );
  });

  it('throws NotEligibleForCancellationError for a non-confirmed appointment', async () => {
    const user = await createUser('cancel3@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(2, 14);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const appt = await prisma.appointment.create({
      data: {
        userId: user.id,
        service: 'Consultation',
        startsAt,
        endsAt,
        status: 'cancelled',
      },
    });

    await expect(svc.cancelAppointment(user.id, appt.id)).rejects.toThrow(
      NotEligibleForCancellationError,
    );
  });

  it('throws AppointmentNotFoundError for non-existent appointment', async () => {
    const user = await createUser('cancel4@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    await expect(svc.cancelAppointment(user.id, 'no-such-id')).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });

  it('throws AppointmentNotFoundError when another user tries to cancel', async () => {
    const user1 = await createUser('cancel5a@example.com');
    const user2 = await createUser('cancel5b@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(2, 14);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const proposal = await svc.createProposal(user1.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });
    const { appointment } = await svc.confirmProposal(user1.id, proposal.proposalId);

    await expect(svc.cancelAppointment(user2.id, appointment.id)).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });
});

describe('Appointment service — proposal expiry boundary', () => {
  it('transitions to expired when clock reaches exact TTL', async () => {
    const user = await createUser('boundary1@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    clock = new Date(proposal.expiresAt);

    await expect(svc.getProposal(user.id, proposal.proposalId)).rejects.toThrow(
      ProposalExpiredError,
    );
  });

  it('keeps proposal pending when clock is just before TTL', async () => {
    const user = await createUser('boundary2@example.com');
    const svc = createServiceWithClock(new Date(BASE_DATE));

    const startsAt = karachiDate(1, 10);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const proposal = await svc.createProposal(user.id, {
      service: 'Consultation',
      startsAt,
      endsAt,
      timezone: BOOKING_TIMEZONE,
      durationMinutes: 30,
    });

    clock = new Date(proposal.expiresAt.getTime() - 1);

    const result = await svc.getProposal(user.id, proposal.proposalId);
    expect(result.status).toBe('pending');
  });
});
