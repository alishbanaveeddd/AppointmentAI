/**
 * M5 — Zod validation schemas for chat endpoints.
 *
 * Schemas for:
 * - createSessionSchema: POST /chat/sessions (optional title)
 * - createMessageSchema: POST /chat/sessions/:sessionId/messages
 *
 * Per docs/API_CONTRACT.md: validate request bodies and params.
 */
import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .optional(),
});

export const createMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(4000, 'Message must be at most 4000 characters'),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
