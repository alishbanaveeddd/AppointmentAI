/**
 * Environment variable validation schema.
 *
 * M1: NODE_ENV (required, enum) and PORT (optional, defaults to 8000).
 * M2: DATABASE_URL (required, PostgreSQL connection string for Prisma).
 * M3: JWT_SECRET (required, min 32 chars) and FRONTEND_URL (required, valid URL).
 * M6: GROQ_API_KEY (required for the backend Groq adapter) and
 *      GROQ_MODEL (optional, defaults to openai/gpt-oss-120b).
 *
 * Rules:
 * - NODE_ENV must be explicitly provided; accepted: development, test, production.
 * - DATABASE_URL must be a valid PostgreSQL connection string.
 * - JWT_SECRET must be at least 32 characters (M3 authentication requirement).
 * - FRONTEND_URL must be a valid URL (M3 CORS allowlist origin).
 * - GROQ_API_KEY is required at M6 so the API fails fast without the provider
 *   credential; the key is never logged or returned to clients.
 * - GROQ_MODEL selects the chat model; an unknown value is rejected by the
 *   provider at request time (graceful fallback), not at startup.
 * - Missing, empty, or unrecognized values cause validation to fail.
 * - PORT defaults to 8000 when unset.
 *
 * Error messages name the failing variable but never reveal secret values
 * or other environment variable contents (per docs/SECURITY.md).
 */
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be a valid PostgreSQL connection string'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required for the AI adapter'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates environment variables from process.env.
 *
 * Exits the process with code 1 if validation fails.
 * Error messages name the variable but never reveal secret values
 * or other environment variable contents (per docs/SECURITY.md).
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'process.env';
      console.error(`  ${field}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}
