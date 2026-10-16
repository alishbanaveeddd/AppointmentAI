/**
 * M2 — Prisma client singleton.
 *
 * In development, a new Prisma client is created per module import to avoid
 * exhausting database connections during hot reloads. In production, a single
 * instance is reused for connection-pool efficiency.
 *
 * Reference: https://www.prisma.io/docs/guides/other/trpc-prisma/client-prisma
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // Allow global `var prisma` in TypeScript (avoid multiple instances in dev).
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
