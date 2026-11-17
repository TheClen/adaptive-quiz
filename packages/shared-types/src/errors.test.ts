import { describe, expect, it } from "vitest";

import { ApiError, ErrorCode } from "./index.js";

describe("ErrorCode", () => {
  it("lists the catalogue of plan §7.3", () => {
    expect(ErrorCode.options).toEqual([
      "invalid_request",
      "rate_limited",
      "budget_exhausted",
      "ai_unavailable",
      "generation_failed",
      "internal",
    ]);
  });
});

describe("ApiError", () => {
  it.each(ErrorCode.options)("accepts code %s", (code) => {
    expect(
      ApiError.safeParse({ error: { code, message: "Something went wrong. Try again." } }).success,
    ).toBe(true);
  });

  it("accepts a retry delay", () => {
    const body = {
      error: { code: "rate_limited", message: "Limit reached.", retryAfterSeconds: 120 },
    };
    expect(ApiError.parse(body)).toEqual(body);
  });

  it.each([0, -5, 1.5])("rejects a retry delay of %d", (retryAfterSeconds) => {
    const body = { error: { code: "rate_limited", message: "Limit reached.", retryAfterSeconds } };
    expect(ApiError.safeParse(body).success).toBe(false);
  });

  it("rejects an unknown code and an empty message", () => {
    expect(
      ApiError.safeParse({ error: { code: "teapot", message: "Short and stout." } }).success,
    ).toBe(false);
    expect(ApiError.safeParse({ error: { code: "internal", message: "" } }).success).toBe(false);
  });
});
