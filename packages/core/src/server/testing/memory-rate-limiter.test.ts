import { describe, expect, it } from "vitest";

import { hashIp } from "../rate-limit/ip-hash.js";
import { type IpLimitName, RATE_LIMITS, type RateLimitTarget } from "../rate-limit/limits.js";
import { RateLimiterUnavailableError } from "../rate-limit/rate-limiter.js";
import { MemoryRateLimiter } from "./memory-rate-limiter.js";

const HOUR_MS = 3_600_000;
/** 2026-11-18T10:00:00Z: the start of an hourly window. */
const START = Date.UTC(2026, 10, 18, 10);

/** A limiter on a clock the test moves by hand. */
function limiterAt(start: number) {
  const clock = { now: start };
  return { clock, limiter: new MemoryRateLimiter({ now: () => clock.now }) };
}

/** Consumes `count` requests and returns how many were allowed. */
async function consumeMany(limiter: MemoryRateLimiter, target: RateLimitTarget, count: number) {
  let allowed = 0;
  for (let index = 0; index < count; index += 1) {
    if ((await limiter.consume(target)).allowed) {
      allowed += 1;
    }
  }
  return allowed;
}

const ipHash = await hashIp("203.0.113.7");

describe("MemoryRateLimiter", () => {
  it.each<[IpLimitName, number]>([
    ["sessions", 5],
    ["questions", 60],
    ["reviews", 15],
  ])("allows %s %i times an hour per IP, then gives the reset time", async (limit, tokens) => {
    const { clock, limiter } = limiterAt(START);
    const target = { limit, ipHash } as const;

    await expect(consumeMany(limiter, target, tokens)).resolves.toBe(tokens);
    clock.now = START + 45 * 60 * 1000;
    await expect(limiter.consume(target)).resolves.toEqual({
      allowed: false,
      code: "rate_limited",
      resetAt: START + HOUR_MS,
      retryAfterSeconds: 15 * 60 + 1,
    });

    // At the reset time the whole previous window still counts; a moment later it no longer blocks.
    clock.now = START + HOUR_MS;
    await expect(limiter.consume(target)).resolves.toMatchObject({ allowed: false });
    clock.now = START + 45 * 60 * 1000 + (15 * 60 + 1) * 1000;
    await expect(limiter.consume(target)).resolves.toMatchObject({ allowed: true });
  });

  it("allows 3,000 model calls a day in all, then reports budget_exhausted until midnight UTC", async () => {
    const { clock, limiter } = limiterAt(Date.UTC(2026, 10, 18));
    const target = { limit: "global" } as const;

    await expect(consumeMany(limiter, target, 3_000)).resolves.toBe(3_000);
    clock.now = Date.UTC(2026, 10, 18, 22);
    await expect(limiter.consume(target)).resolves.toEqual({
      allowed: false,
      code: "budget_exhausted",
      resetAt: Date.UTC(2026, 10, 19),
      retryAfterSeconds: 2 * 60 * 60 + 1,
    });
    clock.now = Date.UTC(2026, 10, 19, 0, 0, 1);
    await expect(limiter.consume(target)).resolves.toMatchObject({ allowed: true });
  });

  it("counts down the remaining requests and does not count refused ones", async () => {
    const { clock, limiter } = limiterAt(START);
    const target = { limit: "sessions", ipHash } as const;

    await expect(limiter.consume(target)).resolves.toEqual({
      allowed: true,
      remaining: 4,
      resetAt: START + HOUR_MS,
    });
    await consumeMany(limiter, target, 10);
    expect(limiter.keys).toHaveLength(RATE_LIMITS.sessions.tokens);

    // Next window, halfway: half of the previous window's 5 still counts (floor 2), so 3 more pass.
    clock.now = START + 1.5 * HOUR_MS;
    await expect(consumeMany(limiter, target, 10)).resolves.toBe(3);
  });

  it("keeps separate counters per IP and per limit", async () => {
    const { limiter } = limiterAt(START);
    const other = await hashIp("198.51.100.1");

    await consumeMany(limiter, { limit: "sessions", ipHash }, 5);
    await expect(limiter.consume({ limit: "sessions", ipHash: other })).resolves.toMatchObject({
      allowed: true,
    });
    await expect(limiter.consume({ limit: "questions", ipHash })).resolves.toMatchObject({
      allowed: true,
    });
    expect(limiter.keys.slice(-2)).toEqual([
      `quiz:rl:sessions:${other}`,
      `quiz:rl:questions:${ipHash}`,
    ]);
  });

  it("throws RateLimiterUnavailableError when marked unavailable", async () => {
    const { limiter } = limiterAt(START);
    limiter.unavailable = true;

    await expect(limiter.consume({ limit: "global" })).rejects.toBeInstanceOf(
      RateLimiterUnavailableError,
    );
    expect(limiter.keys).toEqual([]);
  });
});
