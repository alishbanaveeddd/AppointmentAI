import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    const r = await prisma.$queryRawUnsafe<{ now: string }[]>(`SELECT NOW() as now`);
    console.log('DB OK:', JSON.stringify(r));
    const models = await prisma.$queryRawUnsafe<any[]>(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    console.log('Tables:', models.map((m) => m.tablename).join(', '));
  } catch (e: any) {
    console.log('DB ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
