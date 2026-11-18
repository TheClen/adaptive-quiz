import { ApiError, ErrorCode } from "@ai-in-learning/shared-types";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { ApiFailure, ERROR_CATALOGUE, toApiFailure } from "./errors.js";

describe("ERROR_CATALOGUE", () => {
  it("gives each code the HTTP status of plan §7.3", () => {
    const statuses = Object.fromEntries(
      ErrorCode.options.map((code) => [code, ERROR_CATALOGUE[code].status]),
    );
    expect(statuses).toEqual({
      invalid_request: 400,
      rate_limited: 429,
      budget_exhausted: 503,
      ai_unavailable: 503,
      generation_failed: 502,
      internal: 500,
    });
  });

  it("has messages that fit the ApiError schema", () => {
    for (const code of ErrorCode.options) {
      const body = { error: { code, message: ERROR_CATALOGUE[code].message } };
      expect(ApiError.safeParse(body).success).toBe(true);
    }
  });
});

describe("toApiFailure", () => {
  it("keeps an ApiFailure as it is", () => {
    const failure = new ApiFailure("rate_limited", { retryAfterSeconds: 5 });
    expect(toApiFailure(failure)).toBe(failure);
  });

  it("maps a client-side HTTPException to invalid_request and a server-side one to internal", () => {
    expect(toApiFailure(new HTTPException(415)).code).toBe("invalid_request");
    expect(toApiFailure(new HTTPException(502)).code).toBe("internal");
  });

  it.each([new Error("boom"), new TypeError("x is undefined"), "a string", null])(
    "maps anything else to internal (%j)",
    (thrown) => {
      const failure = toApiFailure(thrown);
      expect(failure.code).toBe("internal");
      expect(failure.message).toBe(ERROR_CATALOGUE.internal.message);
    },
  );
});
