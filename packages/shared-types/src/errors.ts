import { z } from "zod";

/** Every error code the API can return (plan §7.3). */
export const ErrorCode = z.enum([
  "invalid_request",
  "rate_limited",
  "budget_exhausted",
  "ai_unavailable",
  "generation_failed",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/**
 * The single error body shape. `message` comes from a fixed catalogue and never
 * carries upstream details (AC-8.4).
 */
export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string().min(1).max(300),
    retryAfterSeconds: z.int().positive().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
