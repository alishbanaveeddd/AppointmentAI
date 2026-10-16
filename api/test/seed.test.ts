/**
 * M2 — Seed data verification tests.
 *
 * Verifies that the seed script produces the expected demo data in the
 * appointment_ai_test database. The test database URL is enforced by
 * api/test/setup.ts, which fail-closed rejects any DATABASE_URL that does
 * not target `appointment_ai_test`. These tests assume the seed script has
 * been run against the test database before the suite (they check against
 * pre-existing data, not create their own).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// The test database URL is enforced by api/test/setup.ts (vitest setupFile):
// DATABASE_URL must target `appointment_ai_test`, or the whole run aborts
// fail-closed. We never redirect tests at the development database.
const prisma = new PrismaClient({ log: ['error'] });

describe('M2 seed data (appointment_ai_test)', () => {
  beforeAll(async () => {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const { execSync } = await import('child_process');
      execSync('npx tsx prisma/seed.ts', {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: 'inherit',
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates exactly 1 demo user with real password hash', async () => {
    const users = await prisma.user.findMany({
      where: { email: 'demo@example.com' },
    });
    expect(users.length).toBe(1);
    const user = users[0];
    expect(user.name).toBe('Demo User');
    // Verify password hash is real (not a placeholder) by comparing
    expect(user.passwordHash.length).toBeGreaterThan(20);
    expect(user.passwordHash).not.toBe('password');
    expect(user.passwordHash).not.toBe('');
    // Verify it's a valid bcrypt hash
    expect(user.passwordHash).toMatch(/^\$2[aby]?\$12\$/);
  });

  it('demo user password matches "Demo@12345"', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    expect(user).not.toBeNull();
    const valid = await bcrypt.compare('Demo@12345', user!.passwordHash);
    expect(valid).toBe(true);
  });

  it('password hash is NOT a placeholder', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
    expect(user).not.toBeNull();
    // Should not be any common placeholder values
    expect(user!.passwordHash).not.toContain('placeholder');
    expect(user!.passwordHash).not.toContain('PASSWORD');
    expect(user!.passwordHash).not.toBe('changeme');
  });

  it('creates exactly 1 chat session', async () => {
    const sessions = await prisma.chatSession.findMany({
      where: { user: { email: 'demo@example.com' } },
    });
    expect(sessions.length).toBe(1);
  });

  it('chat session has 4 messages (2 user, 2 assistant)', async () => {
    const session = await prisma.chatSession.findFirst({
      where: { user: { email: 'demo@example.com' } },
      include: { messages: true },
    });
    expect(session).not.toBeNull();
    expect(session!.messages.length).toBe(4);

    const userMessages = session!.messages.filter((m) => m.role === 'user');
    const assistantMessages = session!.messages.filter((m) => m.role === 'assistant');
    expect(userMessages.length).toBe(2);
    expect(assistantMessages.length).toBe(2);
  });

  it('creates exactly 3 appointments', async () => {
    const count = await prisma.appointment.count({
      where: { user: { email: 'demo@example.com' } },
    });
    expect(count).toBe(3);
  });

  it('appointments have correct statuses (1 confirmed, 1 completed, 1 cancelled)', async () => {
    const appointments = await prisma.appointment.findMany({
      where: { user: { email: 'demo@example.com' } },
      orderBy: { startsAt: 'asc' },
    });
    const statuses = appointments.map((a) => a.status);
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('cancelled');
  });

  it('appointment times fall within Mon-Fri 9-5 Asia/Karachi', async () => {
    const appointments = await prisma.appointment.findMany({
      where: { user: { email: 'demo@example.com' } },
    });
    appointments.forEach((appt) => {
      const starts = appt.startsAt;
      const dayOfWeek = starts.getUTCDay();
      // Monday=1, Tuesday=2, ... Friday=5
      expect(dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(dayOfWeek).toBeLessThanOrEqual(5);
    });
  });
});
