import { describe, expect, it } from "vitest";

import { hashIp } from "./ip-hash.js";
import { RATE_LIMITS, rateLimitKey } from "./limits.js";
import { retryAfterSeconds } from "./rate-limiter.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

describe("RATE_LIMITS", () => {
  it("holds the limits of plan §11.1", () => {
    expect(RATE_LIMITS).toEqual({
      sessions: { tokens: 5, windowMs: HOUR_MS, code: "rate_limited" },
      questions: { tokens: 60, windowMs: HOUR_MS, code: "rate_limited" },
      reviews: { tokens: 15, windowMs: HOUR_MS, code: "rate_limited" },
      global: { tokens: 3_000, windowMs: DAY_MS, code: "budget_exhausted" },
    });
  });
});

describe("rateLimitKey", () => {
  it("namespaces per-IP keys with the IP hash and the global key alone", async () => {
    const ipHash = await hashIp("203.0.113.7");
    expect(rateLimitKey({ limit: "sessions", ipHash })).toBe(`quiz:rl:sessions:${ipHash}`);
    expect(rateLimitKey({ limit: "questions", ipHash })).toBe(`quiz:rl:questions:${ipHash}`);
    expect(rateLimitKey({ limit: "reviews", ipHash })).toBe(`quiz:rl:reviews:${ipHash}`);
    expect(rateLimitKey({ limit: "global" })).toBe("quiz:rl:global");
  });
});

describe("retryAfterSeconds", () => {
  it("rounds to the first whole second strictly after the reset time", () => {
    expect(retryAfterSeconds(10_000, 0)).toBe(11);
    expect(retryAfterSeconds(10_000, 500)).toBe(10);
    expect(retryAfterSeconds(10_000, 9_999)).toBe(1);
  });

  it("is at least 1", () => {
    expect(retryAfterSeconds(10_000, 10_000)).toBe(1);
    expect(retryAfterSeconds(10_000, 20_000)).toBe(1);
  });
});
