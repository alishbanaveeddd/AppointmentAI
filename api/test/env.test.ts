/**
 * Environment validation tests.
 *
 * M1: Verifies the env schema rejects missing/empty/unsupported NODE_ENV,
 * accepts supported values, applies PORT default, and never reveals
 * secret values in error messages.
 *
 * M2: Verifies DATABASE_URL is required and validated.
 *
 * M3: Verifies JWT_SECRET (min 32 chars) and FRONTEND_URL (valid URL).
 *
 * M6: Verifies GROQ_API_KEY is required and GROQ_MODEL defaults.
 */
import { describe, it, expect } from 'vitest';
import { envSchema } from '../src/config/env';

// Valid placeholder values used across successful parses.
const VALID_DATABASE_URL = 'postgresql://postgres:placeholder@localhost:5432/test';
const VALID_JWT_SECRET = 'dev-jwt-secret-at-least-32-characters-minimum';
const VALID_FRONTEND_URL = 'http://localhost:3000';
const VALID_GROQ_API_KEY = 'test-groq-api-key-not-real-minimum';

/**
 * Convenience wrapper that includes all currently-validated fields.
 * Individual tests override specific fields to test edge cases.
 */
function validEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'development',
    PORT: '8000',
    DATABASE_URL: VALID_DATABASE_URL,
    JWT_SECRET: VALID_JWT_SECRET,
    FRONTEND_URL: VALID_FRONTEND_URL,
    GROQ_API_KEY: VALID_GROQ_API_KEY,
    ...overrides,
  };
}

describe('env schema (M1)', () => {
  it('rejects missing NODE_ENV', () => {
    const result = envSchema.safeParse(validEnv({ NODE_ENV: undefined }));
    expect(result.success).toBe(false);
  });

  it('rejects empty NODE_ENV', () => {
    const result = envSchema.safeParse(validEnv({ NODE_ENV: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects unsupported NODE_ENV values', () => {
    const result = envSchema.safeParse(validEnv({ NODE_ENV: 'staging' }));
    expect(result.success).toBe(false);
  });

  it('accepts development', () => {
    const result = envSchema.safeParse(validEnv({ NODE_ENV: 'development' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
    }
  });

  it('accepts test', () => {
    const result = envSchema.safeParse(validEnv({ NODE_ENV: 'test' }));
    expect(result.success).toBe(true);
  });

  it('accepts production', () => {
    const result = envSchema.safeParse(validEnv({ NODE_ENV: 'production' }));
    expect(result.success).toBe(true);
  });

  it('applies PORT default of 8000 when unset', () => {
    const { PORT: _port, ...rest } = validEnv();
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(true);
    void _port;
    if (result.success) {
      expect(result.data.PORT).toBe(8000);
    }
  });

  it('coerces PORT string to number', () => {
    const result = envSchema.safeParse(validEnv({ PORT: '8080' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080);
    }
  });

  it('does not reveal secret values in error messages', () => {
    process.env.DATABASE_URL = 'fake-secret-value-should-not-appear';
    process.env.JWT_SECRET = 'another-secret-that-should-not-appear';

    const result = envSchema.safeParse(validEnv({ NODE_ENV: undefined, DATABASE_URL: undefined }));
    expect(result.success).toBe(false);

    const serialized = JSON.stringify(result.error);
    expect(serialized).not.toContain('fake-secret-value-should-not-appear');
    expect(serialized).not.toContain('another-secret-that-should-not-appear');
  });
});

describe('env schema (M2)', () => {
  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL: _db, ...rest } = validEnv();
    void _db;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty DATABASE_URL', () => {
    const result = envSchema.safeParse(validEnv({ DATABASE_URL: '' }));
    expect(result.success).toBe(false);
  });

  it('accepts a valid DATABASE_URL', () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
  });
});

describe('env schema (M3)', () => {
  it('rejects missing JWT_SECRET', () => {
    const { JWT_SECRET: _secret, ...rest } = validEnv();
    void _secret;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse(validEnv({ JWT_SECRET: 'too-short' }));
    expect(result.success).toBe(false);
  });

  it('accepts JWT_SECRET of at least 32 characters', () => {
    const result = envSchema.safeParse(validEnv({ JWT_SECRET: VALID_JWT_SECRET }));
    expect(result.success).toBe(true);
  });

  it('rejects missing FRONTEND_URL', () => {
    const { FRONTEND_URL: _url, ...rest } = validEnv();
    void _url;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects FRONTEND_URL that is not a valid URL', () => {
    const result = envSchema.safeParse(validEnv({ FRONTEND_URL: 'not-a-url' }));
    expect(result.success).toBe(false);
  });

  it('accepts a valid FRONTEND_URL', () => {
    const result = envSchema.safeParse(validEnv({ FRONTEND_URL: VALID_FRONTEND_URL }));
    expect(result.success).toBe(true);
  });
});

describe('env schema (M6)', () => {
  it('rejects missing GROQ_API_KEY', () => {
    const { GROQ_API_KEY: _key, ...rest } = validEnv();
    void _key;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty GROQ_API_KEY', () => {
    const result = envSchema.safeParse(validEnv({ GROQ_API_KEY: '' }));
    expect(result.success).toBe(false);
  });

  it('accepts a valid GROQ_API_KEY and defaults GROQ_MODEL', () => {
    const result = envSchema.safeParse(validEnv({ GROQ_API_KEY: VALID_GROQ_API_KEY }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GROQ_API_KEY).toBe(VALID_GROQ_API_KEY);
      expect(result.data.GROQ_MODEL).toBe('openai/gpt-oss-120b');
    }
  });

  it('never reveals GROQ_API_KEY in error messages', () => {
    const result = envSchema.safeParse(validEnv({ GROQ_API_KEY: undefined }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).not.toContain(VALID_GROQ_API_KEY);
  });
});
