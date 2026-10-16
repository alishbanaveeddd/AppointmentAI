/**
 * M3 — Express Request type augmentation.
 *
 * Adds `userId` to the Express Request object so that authentication
 * middleware can attach the authenticated principal and downstream
 * handlers can read it in a type-safe manner.
 *
 * Also augments the base Express Request with `id` for request ID
 * correlation (set by the request-id middleware).
 */

// Augment Express Request with `id` for request correlation.
declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

export interface AuthenticatedRequest {
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}


