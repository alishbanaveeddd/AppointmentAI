/**
 * M3 — JWT utilities.
 *
 * Signs and verifies JWT tokens using the HS256 algorithm with the
 * server-side JWT_SECRET. Tokens carry the user ID as the `sub` claim,
 * plus issuer/audience for bound validation.
 *
 * Per docs/SECURITY.md:
 * - JWT_ISSUER is fixed to '@appointment-ai/api'.
 * - Audience is the FRONTEND_URL.
 * - Default expiry is 24 hours.
 * - The token is delivered ONLY in an HttpOnly cookie, never in the JSON body.
 */
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { Env } from '../config/env';

export const JWT_ISSUER = '@appointment-ai/api';
export const DEFAULT_JWT_EXPIRES_IN = '24h';

/**
 * Signs a JWT for the given user ID.
 * @param userId The authenticated user's UUID (stored as `sub`).
 * @param env Environment configuration (JWT_SECRET, FRONTEND_URL).
 * @param expiresIn Optional expiry override (defaults to 24h).
 * @returns A signed JWT string.
 */
export function signJwt(
  userId: string,
  env: Env,
  expiresIn: StringValue | number = DEFAULT_JWT_EXPIRES_IN,
): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn,
    issuer: JWT_ISSUER,
    audience: env.FRONTEND_URL,
  });
}

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * Verifies a JWT and returns its payload.
 * @param token The JWT string to verify.
 * @param env Environment configuration (JWT_SECRET, FRONTEND_URL).
 * @returns The decoded JWT payload if valid.
 * @throws jwt.JwtPayload expired or invalid error if verification fails.
 */
export function verifyJwt(token: string, env: Env): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: env.FRONTEND_URL,
  }) as JwtPayload;
}
