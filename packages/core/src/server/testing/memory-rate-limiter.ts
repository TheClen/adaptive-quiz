import { RATE_LIMITS, type RateLimitTarget, rateLimitKey } from "../rate-limit/limits.js";
import {
  type RateLimitDecision,
  type RateLimiter,
  RateLimiterUnavailableError,
  toDecision,
} from "../rate-limit/rate-limiter.js";

export interface MemoryRateLimiterOptions {
  /** The clock, in epoch milliseconds. Tests pass a fake one. */
  readonly now?: () => number;
}

/**
 * An in-memory `RateLimiter` for tests (plan §16.1). It applies the same sliding
 * window as Upstash's single-region script: a counter per fixed window, and the
 * previous window's counter weighted by how much of it still overlaps. The reset
 * time is the end of the current window, as Upstash reports it.
 *
 * Set `unavailable` to make every call throw, as when Upstash cannot be reached.
 */
export class MemoryRateLimiter implements RateLimiter {
  /** Every key a request was counted against, in order. */
  readonly keys: string[] = [];
  unavailable = false;
  readonly #counters = new Map<string, number>();
  readonly #now: () => number;

  constructor(options: MemoryRateLimiterOptions = {}) {
    this.#now = options.now ?? Date.now;
  }

  consume(target: RateLimitTarget): Promise<RateLimitDecision> {
    if (this.unavailable) {
      return Promise.reject(new RateLimiterUnavailableError());
    }
    const { tokens, windowMs } = RATE_LIMITS[target.limit];
    const now = this.#now();
    const window = Math.floor(now / windowMs);
    const key = rateLimitKey(target);
    const currentKey = `${key}:${String(window)}`;
    const current = this.#counters.get(currentKey) ?? 0;
    const previous = this.#counters.get(`${key}:${String(window - 1)}`) ?? 0;
    const weightedPrevious = Math.floor((1 - (now % windowMs) / windowMs) * previous);
    const resetAt = (window + 1) * windowMs;

    if (weightedPrevious + current >= tokens) {
      return Promise.resolve(toDecision(target, { allowed: false, remaining: 0, resetAt }, now));
    }
    this.#counters.set(currentKey, current + 1);
    this.keys.push(key);
    const remaining = tokens - (current + 1 + weightedPrevious);
    return Promise.resolve(toDecision(target, { allowed: true, remaining, resetAt }, now));
  }
}
