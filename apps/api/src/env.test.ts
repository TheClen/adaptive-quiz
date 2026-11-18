import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

const VALID = {
  ANTHROPIC_API_KEY: "sk-ant-fake",
  UPSTASH_REDIS_REST_URL: "https://fake-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "fake-token",
  QUIZ_SIGNING_SECRET: "f".repeat(32),
};

describe("loadEnv", () => {
  it("returns every variable when all are valid, and ignores the others", () => {
    expect(loadEnv({ ...VALID, PATH: "/usr/bin" })).toEqual({ ok: true, env: VALID });
  });

  it("trims surrounding whitespace", () => {
    const result = loadEnv({ ...VALID, ANTHROPIC_API_KEY: "  sk-ant-fake\n" });
    expect(result).toEqual({ ok: true, env: VALID });
  });

  it.each([
    ["ANTHROPIC_API_KEY", undefined],
    ["ANTHROPIC_API_KEY", "   "],
    ["UPSTASH_REDIS_REST_URL", "not a url"],
    ["UPSTASH_REDIS_REST_URL", "http://fake-redis.upstash.io"],
    ["UPSTASH_REDIS_REST_TOKEN", ""],
    ["QUIZ_SIGNING_SECRET", "f".repeat(31)],
  ] as const)("reports %s = %j by name only", (name, value) => {
    const result = loadEnv({ ...VALID, [name]: value });

    expect(result).toEqual({ ok: false, invalidVariables: [name] });
    if (value !== undefined && value.trim() !== "") {
      expect(JSON.stringify(result)).not.toContain(value);
    }
  });

  it("lists every invalid variable once, in a fixed order", () => {
    expect(loadEnv({ QUIZ_SIGNING_SECRET: "short", ANTHROPIC_API_KEY: "sk-ant-fake" })).toEqual({
      ok: false,
      invalidVariables: [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "QUIZ_SIGNING_SECRET",
      ],
    });
  });
});
