/**
 * M2 - Database persistence tests.
 *
 * Tests database connectivity, Prisma schema correctness, and CRUD operations
 * for all 5 models: User, ChatSession, ChatMessage, Appointment, BookingProposal.
 *
 * These tests run against the appointment_ai_test database and use a
 * per-test truncate to keep tests isolated.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;`
  );
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "booking_proposals", "appointments", "chat_messages", "chat_sessions", "users" RESTART IDENTITY CASCADE;`
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M2 database persistence", () => {
  describe("database connection", () => {
    it("connects to PostgreSQL via Prisma", async () => {
      const result = await prisma.$queryRawUnsafe("SELECT NOW() as now");
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });

    it("returns a UUID from gen_random_uuid()", async () => {
      const result = await prisma.$queryRawUnsafe("SELECT gen_random_uuid() as id");
      expect(result[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe("schema: tables and columns", () => {
    it("users table has UUID PK with gen_random_uuid default", async () => {
      const cols = await prisma.$queryRawUnsafe("SELECT column_name, column_default, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position");
      const idCol = cols.find((c: any) => c.column_name === "id");
      expect(idCol).toBeDefined();
      expect(idCol.data_type).toBe("uuid");
      expect(idCol.column_default).toContain("gen_random_uuid");
    });

    it("users table has unique constraint on email", async () => {
      const indexes = await prisma.$queryRawUnsafe("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'");
            const uniqueIdx = indexes.find((i: any) => i.indexdef.includes("UNIQUE") && i.indexdef.includes("email"));
      expect(uniqueIdx).toBeDefined();
      expect(uniqueIdx.indexdef).toContain("email");
    });

    it("chat_sessions table has JSONB metadata with default {}", async () => {
      const cols = await prisma.$queryRawUnsafe("SELECT udt_name, column_default FROM information_schema.columns WHERE table_name = 'chat_sessions' AND column_name = 'metadata'");
      expect(cols[0].udt_name).toBe("jsonb");
      expect(cols[0].column_default).toContain("'{}'");
    });

    it("booking_proposals ON DELETE SET NULL on appointment_id FK", async () => {
      const fks = await prisma.$queryRawUnsafe("SELECT conname, confdeltype FROM pg_constraint WHERE conrelid = 'booking_proposals'::regclass AND contype = 'f'");
      const appointmentFk = fks.find((f: any) => f.conname.includes("appointment_id"));
      expect(appointmentFk).toBeDefined();
            expect(appointmentFk.confdeltype).toBe("n");
    });
  });

  describe("indexes match design", () => {
    it("has all 4 performance indexes plus unique email", async () => {
      const indexes = await prisma.$queryRawUnsafe("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('users','chat_sessions','chat_messages','appointments','booking_proposals')");
      const names = indexes.map((i: any) => i.indexname);
      expect(names).toContain("users_email_key");
      expect(names).toContain("idx_chat_sessions_user_updated");
      expect(names).toContain("idx_chat_messages_session_created");
      expect(names).toContain("idx_appointments_user_start");
      expect(names).toContain("idx_booking_proposals_user_expires_status");
    });
  });

  describe("CHECK constraints", () => {
    const constraintList = [
      { table: "chat_messages", conname: "chat_messages_role_check" },
      { table: "appointments", conname: "appointments_status_check" },
      { table: "appointments", conname: "appointments_ends_after_starts" },
      { table: "booking_proposals", conname: "booking_proposals_status_check" },
      { table: "booking_proposals", conname: "booking_proposals_ends_after_starts" },
      { table: "booking_proposals", conname: "booking_proposals_duration_30min" },
    ];
    constraintList.forEach(({ table, conname }) => {
      it(`${conname} exists on ${table}`, async () => {
        const query = `SELECT conname FROM pg_constraint WHERE conrelid = '${table}'::regclass AND contype = 'c' AND conname = '${conname}'`;
        const result = await prisma.$queryRawUnsafe(query);
        expect(result.length).toBe(1);
      });
    });
  });

  describe("exclusion constraint (D-006)", () => {
    it("no_overlapping_confirmed_appointments exists on appointments", async () => {
      const result = await prisma.$queryRawUnsafe("SELECT conname, contype FROM pg_constraint WHERE conrelid = 'appointments'::regclass AND contype = 'x'");
      expect(result.length).toBe(1);
      expect(result[0].conname).toBe("no_overlapping_confirmed_appointments");
    });

    it("prevents overlapping confirmed appointments", async () => {
      const user = await prisma.user.create({ data: { name: "Overlap", email: "overlap@test.com", passwordHash: "hash" } });
      await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T05:00:00Z"), endsAt: new Date("2026-10-19T05:30:00Z"), status: "confirmed" } });
      await expect(prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T05:15:00Z"), endsAt: new Date("2026-10-19T05:45:00Z"), status: "confirmed" } })).rejects.toThrow();
    });

    it("allows adjacent (half-open) confirmed appointments", async () => {
      const user = await prisma.user.create({ data: { name: "Adjacent", email: "adjacent@test.com", passwordHash: "hash" } });
      await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T05:00:00Z"), endsAt: new Date("2026-10-19T05:30:00Z"), status: "confirmed" } });
      const result = await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T05:30:00Z"), endsAt: new Date("2026-10-19T06:00:00Z"), status: "confirmed" } });
      expect(result.id).toBeDefined();
    });

    it("allows overlapping cancelled appointments", async () => {
      const user = await prisma.user.create({ data: { name: "Cancelled", email: "cancelled@test.com", passwordHash: "hash" } });
      await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T05:00:00Z"), endsAt: new Date("2026-10-19T05:30:00Z"), status: "confirmed" } });
      const result = await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T05:15:00Z"), endsAt: new Date("2026-10-19T05:45:00Z"), status: "cancelled" } });
      expect(result.id).toBeDefined();
    });
  });

  describe("CRUD: User", () => {
    it("creates and retrieves a user", async () => {
      const user = await prisma.user.create({ data: { name: "Alice", email: "alice@test.com", passwordHash: "hash123" } });
      expect(user.id).toBeDefined();
      expect(user.email).toBe("alice@test.com");
      const found = await prisma.user.findUnique({ where: { email: "alice@test.com" } });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Alice");
    });

    it("rejects duplicate email", async () => {
      await prisma.user.create({ data: { name: "Bob", email: "dup@test.com", passwordHash: "hash" } });
      await expect(prisma.user.create({ data: { name: "Bob2", email: "dup@test.com", passwordHash: "hash" } })).rejects.toThrow(/P2002|unique|duplicate/i);
    });

    it("updates a user", async () => {
      const user = await prisma.user.create({ data: { name: "Carol", email: "upd@test.com", passwordHash: "hash" } });
      const updated = await prisma.user.update({ where: { id: user.id }, data: { name: "Carol Updated" } });
      expect(updated.name).toBe("Carol Updated");
    });

    it("deletes a user", async () => {
      const user = await prisma.user.create({ data: { name: "Dave", email: "del@test.com", passwordHash: "hash" } });
      await prisma.user.delete({ where: { id: user.id } });
      const found = await prisma.user.findUnique({ where: { id: user.id } });
      expect(found).toBeNull();
    });
  });

  describe("CRUD: ChatSession & ChatMessage", () => {
    it("creates a session with messages via relation", async () => {
      const user = await prisma.user.create({ data: { name: "Eve", email: "sess@test.com", passwordHash: "hash" } });
      const session = await prisma.chatSession.create({
        data: { userId: user.id, title: "Test Session", metadata: { foo: "bar" }, messages: { create: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi!" }] } },
        include: { messages: true },
      });
      expect(session.id).toBeDefined();
      expect(session.messages.length).toBe(2);
    });

    it("rejects invalid chat message role", async () => {
      const user = await prisma.user.create({ data: { name: "RoleTest", email: "role@test.com", passwordHash: "hash" } });
      const session = await prisma.chatSession.create({ data: { userId: user.id, title: "Role", metadata: {} } });
      await expect(prisma.chatMessage.create({ data: { sessionId: session.id, role: "invalid" as any, content: "test" } })).rejects.toThrow();
    });

    it("deletes a session and cascades to messages", async () => {
      const user = await prisma.user.create({ data: { name: "Grace", email: "gc@test.com", passwordHash: "hash" } });
      const session = await prisma.chatSession.create({ data: { userId: user.id, title: "Cascade", metadata: {}, messages: { create: [{ role: "user", content: "gone" }] } } });
      await prisma.chatSession.delete({ where: { id: session.id } });
      const messages = await prisma.chatMessage.findMany({ where: { sessionId: session.id } });
      expect(messages.length).toBe(0);
    });
  });

  describe("CRUD: Appointment", () => {
    it("creates an appointment with default status confirmed", async () => {
      const user = await prisma.user.create({ data: { name: "Heidi", email: "heid@test.com", passwordHash: "hash" } });
      const appt = await prisma.appointment.create({ data: { userId: user.id, service: "Consult", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:30:00+05:00") } });
      expect(appt.id).toBeDefined();
      expect(appt.status).toBe("confirmed");
    });

    it("rejects ends_at <= starts_at", async () => {
      const user = await prisma.user.create({ data: { name: "Ivan", email: "ivan@test.com", passwordHash: "hash" } });
      await expect(prisma.appointment.create({ data: { userId: user.id, service: "Bad", startsAt: new Date("2026-10-19T10:30:00+05:00"), endsAt: new Date("2026-10-19T10:00:00+05:00") } })).rejects.toThrow();
    });

    it("rejects invalid status", async () => {
      const user = await prisma.user.create({ data: { name: "Judy", email: "judy@test.com", passwordHash: "hash" } });
      await expect(prisma.appointment.create({ data: { userId: user.id, service: "Bad", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:30:00+05:00"), status: "invalid" as any } })).rejects.toThrow();
    });

    it("updates appointment status", async () => {
      const user = await prisma.user.create({ data: { name: "Karl", email: "karl@test.com", passwordHash: "hash" } });
      const appt = await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T11:00:00+05:00"), endsAt: new Date("2026-10-19T11:30:00+05:00") } });
      const updated = await prisma.appointment.update({ where: { id: appt.id }, data: { status: "completed" } });
      expect(updated.status).toBe("completed");
    });

    it("deletes an appointment", async () => {
      const user = await prisma.user.create({ data: { name: "Leo", email: "leo@test.com", passwordHash: "hash" } });
      const appt = await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T12:00:00+05:00"), endsAt: new Date("2026-10-19T12:30:00+05:00") } });
      await prisma.appointment.delete({ where: { id: appt.id } });
      const found = await prisma.appointment.findUnique({ where: { id: appt.id } });
      expect(found).toBeNull();
    });
  });

  describe("CRUD: BookingProposal", () => {
    it("creates a booking proposal with 30-minute duration", async () => {
      const user = await prisma.user.create({ data: { name: "Mia", email: "mia@test.com", passwordHash: "hash" } });
      const proposal = await prisma.bookingProposal.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:30:00+05:00"), timezone: "Asia/Karachi", durationMinutes: 30, expiresAt: new Date("2026-10-19T15:00:00+05:00") } });
      expect(proposal.proposalId).toBeDefined();
      expect(proposal.status).toBe("pending");
    });

    it("rejects non-30-minute duration", async () => {
      const user = await prisma.user.create({ data: { name: "Nina", email: "nina@test.com", passwordHash: "hash" } });
      await expect(prisma.bookingProposal.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:45:00+05:00"), timezone: "Asia/Karachi", durationMinutes: 45, expiresAt: new Date("2026-10-19T15:00:00+05:00") } })).rejects.toThrow();
    });

    it("rejects invalid status", async () => {
      const user = await prisma.user.create({ data: { name: "Oscar", email: "oscar@test.com", passwordHash: "hash" } });
      await expect(prisma.bookingProposal.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:30:00+05:00"), timezone: "Asia/Karachi", durationMinutes: 30, expiresAt: new Date("2026-10-19T15:00:00+05:00"), status: "invalid" as any } })).rejects.toThrow();
    });

    it("links to appointment via appointment_id and sets NULL on deletion", async () => {
      const user = await prisma.user.create({ data: { name: "Paul", email: "paul@test.com", passwordHash: "hash" } });
      const appt = await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:30:00+05:00") } });
      const proposal = await prisma.bookingProposal.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T10:00:00+05:00"), endsAt: new Date("2026-10-19T10:30:00+05:00"), timezone: "Asia/Karachi", durationMinutes: 30, expiresAt: new Date("2026-10-19T15:00:00+05:00"), appointmentId: appt.id, status: "confirmed" } });
      expect(proposal.appointmentId).toBe(appt.id);
      await prisma.appointment.delete({ where: { id: appt.id } });
      const refreshed = await prisma.bookingProposal.findUnique({ where: { proposalId: proposal.proposalId } });
      expect(refreshed).not.toBeNull();
      expect(refreshed!.appointmentId).toBeNull();
    });

    it("deletes a proposal", async () => {
      const user = await prisma.user.create({ data: { name: "Quinn", email: "quinn@test.com", passwordHash: "hash" } });
      const proposal = await prisma.bookingProposal.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T14:00:00+05:00"), endsAt: new Date("2026-10-19T14:30:00+05:00"), timezone: "Asia/Karachi", durationMinutes: 30, expiresAt: new Date("2026-10-19T15:00:00+05:00") } });
      await prisma.bookingProposal.delete({ where: { proposalId: proposal.proposalId } });
      const found = await prisma.bookingProposal.findUnique({ where: { proposalId: proposal.proposalId } });
      expect(found).toBeNull();
    });
  });

  describe("referential integrity", () => {
    it("cascade deletes appointments when user is deleted", async () => {
      const user = await prisma.user.create({ data: { name: "CascAppt", email: "casc@appt.test.com", passwordHash: "hash" } });
      await prisma.appointment.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T13:00:00+05:00"), endsAt: new Date("2026-10-19T13:30:00+05:00") } });
      await prisma.user.delete({ where: { id: user.id } });
      const found = await prisma.appointment.findMany({ where: { userId: user.id } });
      expect(found.length).toBe(0);
    });

    it("cascade deletes booking proposals when user is deleted", async () => {
      const user = await prisma.user.create({ data: { name: "CascProp", email: "casc@prop.test.com", passwordHash: "hash" } });
      await prisma.bookingProposal.create({ data: { userId: user.id, service: "C", startsAt: new Date("2026-10-19T13:00:00+05:00"), endsAt: new Date("2026-10-19T13:30:00+05:00"), timezone: "Asia/Karachi", durationMinutes: 30, expiresAt: new Date("2026-10-19T18:00:00+05:00") } });
      await prisma.user.delete({ where: { id: user.id } });
      const found = await prisma.bookingProposal.findMany({ where: { userId: user.id } });
      expect(found.length).toBe(0);
    });
  });
});
