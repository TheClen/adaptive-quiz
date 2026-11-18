import { Redis, type Requester, type UpstashRequest } from "@upstash/redis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashIp } from "./ip-hash.js";
import { RATE_LIMITS, type RateLimitTarget } from "./limits.js";
import { RateLimiterUnavailableError } from "./rate-limiter.js";
import { createUpstashRateLimiter, RATE_LIMIT_TIMEOUT_MS } from "./upstash-rate-limiter.js";

const RAW_IP = "203.0.113.7";
/** 2026-11-18T10:30:00Z: 30 minutes into an hourly window, 10.5 hours into a daily one. */
const NOW = Date.UTC(2026, 10, 18, 10, 30);

type Answer = (request: UpstashRequest) => Promise<{ result?: unknown; error?: string }>;

/**
 * A Redis client whose HTTP layer is a fake `Requester`: it records each command and
 * answers with `answer`. Nothing reaches Upstash (principle VI).
 */
function fakeRedis(answer: Answer) {
  const commands: unknown[][] = [];
  const requester: Requester = {
    request: (request) => {
      commands.push(request.body as unknown[]);
      // The client parses the result itself; the fake answers in the script's shape.
      return answer(request) as Promise<never>;
    },
  };
  return { redis: new Redis(requester), commands };
}

/** The sliding-window script returns `[remaining, limit]`, or `[-1, limit]` when refused. */
function scriptResult(remaining: number, limit: number): Answer {
  return () => Promise.resolve({ result: [remaining, limit] });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createUpstashRateLimiter", () => {
  it("runs the sliding window on the plan's keys, with the IP hash and never the raw IP", async () => {
    const { redis, commands } = fakeRedis(scriptResult(1, 5));
    const limiter = createUpstashRateLimiter({ redis });
    const ipHash = await hashIp(RAW_IP);
    const hour = Math.floor(NOW / 3_600_000);
    const day = Math.floor(NOW / 86_400_000);

    await limiter.consume({ limit: "sessions", ipHash });
    await limiter.consume({ limit: "questions", ipHash });
    await limiter.consume({ limit: "reviews", ipHash });
    await limiter.consume({ limit: "global" });

    // [evalsha, script hash, key count, current window key, previous window key,
    //  tokens, now, window in ms, increment]
    expect(commands.map((command) => command.slice(2))).toEqual([
      [
        2,
        `quiz:rl:sessions:${ipHash}:${String(hour)}`,
        `quiz:rl:sessions:${ipHash}:${String(hour - 1)}`,
        5,
        NOW,
        3_600_000,
        1,
      ],
      [
        2,
        `quiz:rl:questions:${ipHash}:${String(hour)}`,
        `quiz:rl:questions:${ipHash}:${String(hour - 1)}`,
        60,
        NOW,
        3_600_000,
        1,
      ],
      [
        2,
        `quiz:rl:reviews:${ipHash}:${String(hour)}`,
        `quiz:rl:reviews:${ipHash}:${String(hour - 1)}`,
        15,
        NOW,
        3_600_000,
        1,
      ],
      [
        2,
        `quiz:rl:global:${String(day)}`,
        `quiz:rl:global:${String(day - 1)}`,
        3_000,
        NOW,
        86_400_000,
        1,
      ],
    ]);
    expect(commands.every((command) => command[0] === "evalsha")).toBe(true);
    expect(JSON.stringify(commands)).not.toContain(RAW_IP);
  });

  it("allows a request with the remaining count and the end of the window", async () => {
    const { redis } = fakeRedis(scriptResult(3, 5));
    const limiter = createUpstashRateLimiter({ redis });

    await expect(
      limiter.consume({ limit: "sessions", ipHash: await hashIp(RAW_IP) }),
    ).resolves.toEqual({
      allowed: true,
      remaining: 3,
      resetAt: Date.UTC(2026, 10, 18, 11),
    });
  });

  it("refuses a per-IP request with rate_limited and the wait until the window ends", async () => {
    const { redis } = fakeRedis(scriptResult(-1, 5));
    const limiter = createUpstashRateLimiter({ redis });

    await expect(
      limiter.consume({ limit: "sessions", ipHash: await hashIp(RAW_IP) }),
    ).resolves.toEqual({
      allowed: false,
      code: "rate_limited",
      resetAt: Date.UTC(2026, 10, 18, 11),
      retryAfterSeconds: 30 * 60 + 1,
    });
  });

  it("refuses a model call past the global cap with budget_exhausted", async () => {
    const { redis } = fakeRedis(scriptResult(-1, RATE_LIMITS.global.tokens));
    const limiter = createUpstashRateLimiter({ redis });

    await expect(limiter.consume({ limit: "global" })).resolves.toEqual({
      allowed: false,
      code: "budget_exhausted",
      resetAt: Date.UTC(2026, 10, 19),
      retryAfterSeconds: 13.5 * 60 * 60 + 1,
    });
  });

  describe("fails closed", () => {
    const target: RateLimitTarget = { limit: "global" };

    it("when Redis returns an error, without its message", async () => {
      const { redis } = fakeRedis(() => Promise.resolve({ error: "WRONGPASS token=secret-token" }));
      const result = createUpstashRateLimiter({ redis }).consume(target);

      await expect(result).rejects.toBeInstanceOf(RateLimiterUnavailableError);
      await expect(result).rejects.toThrow(/^The rate-limit store did not respond\.$/);
    });

    it("when the request to Upstash fails", async () => {
      const { redis } = fakeRedis(() => Promise.reject(new Error("fetch failed")));

      await expect(createUpstashRateLimiter({ redis }).consume(target)).rejects.toMatchObject({
        name: "RateLimiterUnavailableError",
        code: "ai_unavailable",
      });
    });

    it("when Upstash does not answer in time", async () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(NOW);
      const { redis } = fakeRedis(() => new Promise(() => undefined));
      const result = createUpstashRateLimiter({ redis }).consume(target);
      const settled = expect(result).rejects.toBeInstanceOf(RateLimiterUnavailableError);

      await vi.advanceTimersByTimeAsync(RATE_LIMIT_TIMEOUT_MS);
      await settled;
    });
  });
});
