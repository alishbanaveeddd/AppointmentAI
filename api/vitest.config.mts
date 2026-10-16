import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Load .env so DATABASE_URL is available during tests and Prisma client can connect.
// This runs once before any test file is imported.
import { config } from 'dotenv';
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Enforces that every test file connects ONLY to `appointment_ai_test`.
    // Runs before any test module is imported, so top-level PrismaClient() calls
    // already see the guarded DATABASE_URL. Never rewrites the URL silently.
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    // Run DB-dependent tests in sequence to avoid contention on the test database.
    // (vitest runs files in parallel by default; we disable parallelism for safety.)
    fileParallelism: false,
  },
});
