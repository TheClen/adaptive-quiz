import type { ErrorCode } from "@ai-in-learning/shared-types";

import type { IpHash } from "./ip-hash.js";

/** The limiters counted per visitor IP. */
export type IpLimitName = "sessions" | "questions" | "reviews";

/** Every limiter of plan §11.1. */
export type RateLimitName = IpLimitName | "global";

/** The catalogue codes a refusal maps to (plan §7.3). */
export type RateLimitCode = Extract<ErrorCode, "rate_limited" | "budget_exhausted">;

export interface RateLimitDefinition {
  /** Requests allowed per window. */
  readonly tokens: number;
  /** The sliding window, in milliseconds. */
  readonly windowMs: number;
  /** What the API returns when the limit is reached. */
  readonly code: RateLimitCode;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The limits of plan §11.1. They are constants, so a change goes through review.
 *
 * - `sessions`: `next-question` with empty `answers` (NFR-4, D3).
 * - `questions`: every `next-question`, so a forged non-empty state cannot skip the
 *   session counter.
 * - `reviews`: every `code-review`.
 * - `global`: every model call, retries included. Reaching it means the demo's daily
 *   budget is used up, so it maps to `budget_exhausted` (AC-8.3).
 */
export const RATE_LIMITS = {
  sessions: { tokens: 5, windowMs: HOUR_MS, code: "rate_limited" },
  questions: { tokens: 60, windowMs: HOUR_MS, code: "rate_limited" },
  reviews: { tokens: 15, windowMs: HOUR_MS, code: "rate_limited" },
  global: { tokens: 3_000, windowMs: DAY_MS, code: "budget_exhausted" },
} as const satisfies Record<RateLimitName, RateLimitDefinition>;

/** Every rate-limit key starts with this, inside the app's `quiz:` namespace (ADR 0004). */
export const RATE_LIMIT_PREFIX = "quiz:rl";

/** What one request is counted against: a per-IP limit with the IP's hash, or the global cap. */
export type RateLimitTarget =
  { readonly limit: IpLimitName; readonly ipHash: IpHash } | { readonly limit: "global" };

/** The part of the key after the prefix: `sessions:<ipHash>`, or `global`. */
export function rateLimitIdentifier(target: RateLimitTarget): string {
  return target.limit === "global" ? "global" : `${target.limit}:${target.ipHash}`;
}

/**
 * The limiter key of plan §11.1, for example `quiz:rl:sessions:<ipHash>` or
 * `quiz:rl:global`. The sliding window stores one counter per window, under this
 * key followed by `:<window number>`.
 */
export function rateLimitKey(target: RateLimitTarget): string {
  return `${RATE_LIMIT_PREFIX}:${rateLimitIdentifier(target)}`;
}
