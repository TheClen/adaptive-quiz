import { RATE_LIMITS, type RateLimitCode, type RateLimitTarget } from "./limits.js";

export type RateLimitDecision =
  | {
      readonly allowed: true;
      /** Requests left in the window after this one. */
      readonly remaining: number;
      /** When the current window ends, in epoch milliseconds. */
      readonly resetAt: number;
    }
  | {
      readonly allowed: false;
      readonly code: RateLimitCode;
      /** When the current window ends, in epoch milliseconds. */
      readonly resetAt: number;
      /** For `Retry-After` and the error body (AC-8.2). At least 1. */
      readonly retryAfterSeconds: number;
    };

/**
 * Counts requests against the limits of plan §11.1. A refused request is not
 * counted. When the store cannot answer, `consume` throws
 * `RateLimiterUnavailableError`: callers fail closed and never call the model
 * unprotected.
 */
export interface RateLimiter {
  consume(target: RateLimitTarget): Promise<RateLimitDecision>;
}

/**
 * The rate-limit store did not answer (error or timeout). The API maps it to
 * `ai_unavailable` (plan §11.1). The message is fixed and the upstream error is
 * dropped, so nothing from the store reaches a response or a log line.
 */
export class RateLimiterUnavailableError extends Error {
  override readonly name = "RateLimiterUnavailableError";
  readonly code = "ai_unavailable";

  constructor() {
    super("The rate-limit store did not respond.");
  }
}

/**
 * Whole seconds until a retry can succeed. The sliding window allows a request again
 * once its window has ended (and often earlier), so this rounds to the first whole
 * second strictly after `resetAt`.
 */
export function retryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.floor((resetAt - now) / 1000) + 1);
}

/** The decision both adapters return, from the limiter's raw answer. */
export function toDecision(
  target: RateLimitTarget,
  answer: { readonly allowed: boolean; readonly remaining: number; readonly resetAt: number },
  now: number,
): RateLimitDecision {
  if (answer.allowed) {
    return { allowed: true, remaining: answer.remaining, resetAt: answer.resetAt };
  }
  return {
    allowed: false,
    code: RATE_LIMITS[target.limit].code,
    resetAt: answer.resetAt,
    retryAfterSeconds: retryAfterSeconds(answer.resetAt, now),
  };
}
