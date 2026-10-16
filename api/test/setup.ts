/**
 * Shared test setup (registered via vitest.config.mts → `setupFiles`).
 *
 * Runs before every test file is imported, so every top-level
 * `new PrismaClient(...)` in a test module already sees the guarded URL.
 *
 * Purpose:
 *  - Ensure automated tests target ONLY the isolated `appointment_ai_test`
 *    database (never `appointment_ai_dev` or a production database).
 *  - Fail-closed: abort the run rather than silently rewriting a
 *    misconfigured URL.
 *  - Never inspect or log credentials / the full database URL.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// (Re)load .env with override:true before every test file. vitest runs this
// setupFile before each test file in one worker process (fileParallelism is
// disabled), so a prior file that mutated process.env.DATABASE_URL — e.g.
// env.test.ts's secret-redaction test sets it to a fake, non-URL value —
// cannot poison subsequent files. Restoring only the DATABASE_URL segment
// keeps credentials out of the log and preserves any CLI-set non-DATABASE_URL
// variables.
config({ path: resolve(__dirname, '..', '.env'), override: true });

const REQUIRED_TEST_DB = 'appointment_ai_test';

const raw = process.env.DATABASE_URL;
if (!raw) {
  throw new Error(
    'DATABASE_URL must be set in the environment (see .env / .env.example).',
  );
}

let parsed: URL;
try {
  parsed = new URL(raw);
} catch {
  throw new Error('DATABASE_URL is not a valid URL — check the value in .env.');
}

// Extract only the database name segment (no credentials involved).
const dbName = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '').split('?')[0];

// Fail-closed guard: any database other than the test database is refused.
// This is what keeps tests from truncating/writing `appointment_ai_dev`.
if (dbName !== REQUIRED_TEST_DB) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL targets database "${dbName}", ` +
      `but automated tests must use "${REQUIRED_TEST_DB}". ` +
      'Point DATABASE_URL at /appointment_ai_test (see .env.example) and retry.',
  );
}

// Restore the validated canonical test URL from .env (defends against in-suite
// process.env pollution by other test files). We never log the full URL.
process.env.DATABASE_URL = parsed.toString();
export {};
