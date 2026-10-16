/**
 * M2 Seed script.
 *
 * Creates deterministic demo data: a demo user (with a real generated password
 * hash, NOT a placeholder), one chat session, sample messages, and sample
 * appointments. Safe to re-run: it resets the database to a clean state first.
 *
 * Per DATABASE_DESIGN.md: "Seed scripts must create a demo user with a real
 * generated password hash, one chat session, sample messages, and sample
 * appointments. Never ship a placeholder hash as a working credential."
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Business configuration (D-008): Asia/Karachi, Mon-Fri 9:00-17:00, 30-min slots.
// Seed appointments must fall within these windows.

async function main(): Promise<void> {
  // --- 1. Clean slate (idempotent reset) ---
  await prisma.$executeRawUnsafe(`
                TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users"
    RESTART IDENTITY CASCADE;
  `);

  // --- 2. Demo user with real password hash ---
  // Password: "Demo@12345" — generated with bcrypt, NOT a placeholder.
  const passwordHash = await bcrypt.hash('Demo@12345', 12);

  const user = await prisma.user.create({
    data: {
      name: 'Demo User',
      email: 'demo@example.com',
      passwordHash,
    },
  });

  // --- 3. One chat session ---
  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      title: 'Appointment Booking Assistant',
            metadata: { model: 'gpt-4o-mini', locale: 'en' },
    },
  });

  // --- 4. Sample messages (user -> assistant -> user -> assistant) ---
  const now = new Date();
  await prisma.chatMessage.createMany({
    data: [
      {
        sessionId: session.id,
        role: 'user',
        content: 'I need a consultation on Monday morning.',
        createdAt: new Date(now.getTime() - 86400000), // 1 day ago
      },
      {
        sessionId: session.id,
        role: 'assistant',
        content: 'I can help with that. What type of consultation would you like?',
        createdAt: new Date(now.getTime() - 86400000 + 5000),
      },
      {
        sessionId: session.id,
        role: 'user',
        content: 'A general consultation. Please find me a slot.',
        createdAt: now,
      },
      {
        sessionId: session.id,
        role: 'assistant',
        content: 'I have a slot available Monday at 10:00 AM Asia/Karachi. Would you like me to book it?',
        createdAt: new Date(now.getTime() + 3000),
      },
    ],
  });

  // --- 5. Sample appointments (valid times: Mon–Fri 9:00–17:00 Asia/Karachi) ---
  // Dynamically compute upcoming business days relative to now so appointments are always in the future
  const getNextWeekday = (daysAhead: number, hour: number, minute: number): { startsAt: Date; endsAt: Date } => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    // Ensure Monday-Friday (if weekend, push to Monday)
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
    d.setHours(hour, minute, 0, 0);
    const ends = new Date(d.getTime() + 30 * 60 * 1000);
    return { startsAt: d, endsAt: ends };
  };

  const slot1 = getNextWeekday(2, 10, 0); // ~2 days ahead, 10:00 AM
  const slot2 = getNextWeekday(3, 14, 0); // ~3 days ahead, 02:00 PM
  const slot3 = getNextWeekday(4, 11, 30); // ~4 days ahead, 11:30 AM

  const pastSlot1 = new Date(now.getTime() - 48 * 3600 * 1000);
  pastSlot1.setHours(11, 0, 0, 0);
  const pastSlot1End = new Date(pastSlot1.getTime() + 30 * 60 * 1000);

  const pastSlot2 = new Date(now.getTime() - 24 * 3600 * 1000);
  pastSlot2.setHours(15, 30, 0, 0);
  const pastSlot2End = new Date(pastSlot2.getTime() + 30 * 60 * 1000);

  await prisma.appointment.createMany({
    data: [
      {
        userId: user.id,
        service: 'Dental Checkup & Scaling with Dr. Ahmed Malik',
        startsAt: slot1.startsAt,
        endsAt: slot1.endsAt,
        status: 'confirmed',
      },
      {
        userId: user.id,
        service: 'Cardiology Consultation with Dr. Sarah Khan',
        startsAt: slot2.startsAt,
        endsAt: slot2.endsAt,
        status: 'confirmed',
      },
      {
        userId: user.id,
        service: 'General Wellness Checkup with Dr. Ayesha Noor',
        startsAt: slot3.startsAt,
        endsAt: slot3.endsAt,
        status: 'confirmed',
      },
      {
        userId: user.id,
        service: 'Teeth Whitening Consultation with Dr. Ahmed Malik',
        startsAt: pastSlot1,
        endsAt: pastSlot1End,
        status: 'completed',
      },
      {
        userId: user.id,
        service: 'Pediatric Follow-up with Dr. Bilal Qureshi',
        startsAt: pastSlot2,
        endsAt: pastSlot2End,
        status: 'cancelled',
      },
    ],
  });

  console.log('Seed completed:');
  console.log('  - 1 demo user created (email: demo@example.com)');
  console.log('  - 1 chat session with 4 messages');
  console.log('  - 5 appointments (3 upcoming confirmed, 1 completed, 1 cancelled)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
