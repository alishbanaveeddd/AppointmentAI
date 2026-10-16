/**
 * M3 — Authentication service.
 *
 * Encapsulates auth business logic: user registration, login, and
 * password hash management. Uses bcrypt (work factor 12) for password
 * hashing and JWT for session tokens.
 *
 * Per docs/SECURITY.md:
 * - Passwords are hashed with bcrypt (never stored in plaintext).
 * - Login failures return a generic message (no account enumeration).
 * - The service returns a sanitized user summary (id, name, email) —
 *   never the password hash.
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env';
import { signJwt } from '../lib/jwt';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super('An account with this email is already registered.');
    this.name = 'EmailAlreadyInUseError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export interface AuthServiceDeps {
  prisma: PrismaClient;
  env: Env;
  bcryptRounds?: number;
}

export function createAuthService({ prisma, env, bcryptRounds = 12 }: AuthServiceDeps) {
  /**
   * Registers a new user.
   * Throws EmailAlreadyInUseError if the email is already taken.
   * Returns the user summary and a signed JWT.
   */
  async function signup(name: string, email: string, password: string): Promise<{
    user: UserSummary;
    token: string;
  }> {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);

    try {
      const user = await prisma.user.create({
        data: { name, email, passwordHash },
      });

      const token = signJwt(user.id, env);

      const summary: UserSummary = {
        id: user.id,
        name: user.name,
        email: user.email,
      };

      return { user: summary, token };
    } catch (err: unknown) {
      // Prisma throws a P2021 (or similar) unique-constraint violation.
      // We map it to our domain error for a generic message.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new EmailAlreadyInUseError();
      }
      throw err;
    }
  }

  /**
   * Authenticates a user by email/password.
   * Throws InvalidCredentialsError on any failure (wrong email or wrong password).
   * Returns the user summary and a signed JWT on success.
   */
  async function login(email: string, password: string): Promise<{
    user: UserSummary;
    token: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Deliberately generic — do not reveal whether email exists.
      throw new InvalidCredentialsError();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const token = signJwt(user.id, env);

    const summary: UserSummary = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return { user: summary, token };
  }

  return { signup, login };
}
