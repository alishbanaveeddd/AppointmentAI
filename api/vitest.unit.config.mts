import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Database-free unit tests only.
//
// IMPORTANT: this config does NOT register `test/setup.ts` as a setupFile.
// The main `vitest.config.mts` (used by `npm run test`) registers setup.ts,
// which fail-closed guarantees every test connects only to the
// `appointment_ai_test` database. This separate config runs ONLY the pure unit
// tests (Groq adapter, env schema, health) that require no database and no live
// provider key, so they can be executed without provisioning a database.
//
// This does NOT weaken the isolation guard: the main suite still uses setup.ts
// and the `appointment_ai_test` requirement is untouched.
const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  test: {
    // DB-free files only. chat.test.ts/seed.test.ts/database.test.ts are
    // intentionally excluded — they need the `appointment_ai_test` DB.
    include: ['test/groq-adapter.test.ts', 'test/health.test.ts', 'test/env.test.ts'],
    environment: 'node',
    fileParallelism: false,
    // Placeholder keys: no real provider credential or database is needed.
    env: {
      NODE_ENV: 'test',
      GROQ_API_KEY: 'test-not-real-do-not-use',
      GROQ_MODEL: 'llama-3.3-70b-versatile',
    },
  },
});
