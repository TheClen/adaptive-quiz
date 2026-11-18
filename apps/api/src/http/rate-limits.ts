import {
  hashIp,
  type IpHash,
  type ModelClient,
  type RateLimiter,
  type RateLimitTarget,
} from "@ai-in-learning/core/server";

import { ApiFailure } from "./errors.js";

/**
 * What requests without `x-forwarded-for` are counted under. Vercel always sets the
 * header (manual check M3), so in practice this is the local dev server. Sharing one
 * bucket keeps every limit in force rather than letting such requests skip them.
 */
export const UNKNOWN_CLIENT = "unknown-client";

/** The key for per-IP limits: the visitor's IP hash, or the shared unknown bucket. */
export async function clientKey(ipHash: IpHash | null): Promise<IpHash> {
  return ipHash ?? hashIp(UNKNOWN_CLIENT);
}

/**
 * Counts one request against a limit, or throws the catalogue failure: `rate_limited`
 * with its retry delay (AC-8.2), or `budget_exhausted` for the global cap (AC-8.3).
 * When the store cannot answer, `RateLimiterUnavailableError` propagates and the
 * request fails closed with `ai_unavailable` (plan §11.1).
 */
export async function enforceLimit(limiter: RateLimiter, target: RateLimitTarget): Promise<void> {
  const decision = await limiter.consume(target);
  if (decision.allowed) {
    return;
  }
  throw decision.code === "rate_limited"
    ? new ApiFailure("rate_limited", { retryAfterSeconds: decision.retryAfterSeconds })
    : new ApiFailure(decision.code);
}

/**
 * The model client with the global cap in front: every call, retries included, is
 * counted against `global` before it reaches the model (plan §11.1). `onCall` runs
 * once the call is allowed, so the request log can count attempts.
 */
export function withGlobalCap(
  model: ModelClient,
  limiter: RateLimiter,
  onCall: () => void = () => undefined,
): ModelClient {
  return {
    async generate(request) {
      await enforceLimit(limiter, { limit: "global" });
      onCall();
      return model.generate(request);
    },
  };
}
