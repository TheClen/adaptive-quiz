import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  RATE_LIMIT_PREFIX,
  RATE_LIMITS,
  type RateLimitName,
  type RateLimitTarget,
  rateLimitIdentifier,
} from "./limits.js";
import {
  type RateLimitDecision,
  type RateLimiter,
  RateLimiterUnavailableError,
  toDecision,
} from "./rate-limiter.js";

/**
 * How long a check may take before it counts as unavailable. Upstash REST answers
 * in tens of milliseconds; past this the request fails closed (plan §11.1).
 */
export const RATE_LIMIT_TIMEOUT_MS = 2_000;

export type UpstashRateLimiterOptions =
  /** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. */
  | { readonly url: string; readonly token: string }
  /** A ready client. Tests pass one built on a fake `Requester` (principle VI). */
  | { readonly redis: Redis };

function createLimiter(redis: Redis, name: RateLimitName): Ratelimit {
  const { tokens, windowMs } = RATE_LIMITS[name];
  return new Ratelimit({
    redis,
    prefix: RATE_LIMIT_PREFIX,
    // `String()` widens the template to `${string} ms`; the value is a number of ms.
    limiter: Ratelimit.slidingWindow(tokens, `${String(windowMs)} ms` as Duration),
    // The default in-memory cache of blocked identifiers would keep state between
    // requests in the function instance (principle V). Redis is the only store.
    ephemeralCache: false,
    analytics: false,
    // On timeout Upstash allows the request (`reason: "timeout"`); `consume` turns
    // that into a refusal.
    timeout: RATE_LIMIT_TIMEOUT_MS,
  });
}

/**
 * The Upstash adapter: one sliding-window `Ratelimit` per limit of plan §11.1, all
 * under the `quiz:rl` prefix. Redis stores only IP hashes, never raw IPs.
 */
export function createUpstashRateLimiter(options: UpstashRateLimiterOptions): RateLimiter {
  const redis =
    "redis" in options
      ? options.redis
      : new Redis({ url: options.url, token: options.token, enableTelemetry: false });
  const limiters: Record<RateLimitName, Ratelimit> = {
    sessions: createLimiter(redis, "sessions"),
    questions: createLimiter(redis, "questions"),
    reviews: createLimiter(redis, "reviews"),
    global: createLimiter(redis, "global"),
  };

  return {
    async consume(target: RateLimitTarget): Promise<RateLimitDecision> {
      let response;
      try {
        response = await limiters[target.limit].limit(rateLimitIdentifier(target));
        await response.pending;
      } catch {
        throw new RateLimiterUnavailableError();
      }
      if (response.reason === "timeout") {
        throw new RateLimiterUnavailableError();
      }
      return toDecision(
        target,
        { allowed: response.success, remaining: response.remaining, resetAt: response.reset },
        Date.now(),
      );
    },
  };
}
