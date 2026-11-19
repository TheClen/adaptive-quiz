import { ErrorCode } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { errorContent } from "./errorMessages.js";

describe("errorContent", () => {
  it.each([
    ["invalid_request", "Something went wrong with this session. Please start a new one.", "home"],
    [
      "budget_exhausted",
      "The demo is temporarily unavailable because its monthly AI budget is used up. Please come back later.",
      "home",
    ],
    ["ai_unavailable", "The AI service is not responding. Try again.", "retry"],
    ["generation_failed", "We couldn't prepare a good question. Try again.", "retry"],
    ["internal", "Something went wrong. Try again.", "retry"],
  ] as const)("gives %s its catalogue message", (code, message, action) => {
    expect(errorContent({ code })).toMatchObject({ message, action });
  });

  it("has an entry for every error code", () => {
    for (const code of ErrorCode.options) {
      expect(errorContent({ code }).message).not.toBe("");
    }
  });

  it.each([
    [1, "about 1 minute"],
    [60, "about 1 minute"],
    [61, "about 2 minutes"],
    [2_700, "about 45 minutes"],
  ])("rounds a wait of %i seconds up to %s (AC-8.2)", (retryAfterSeconds, wait) => {
    expect(errorContent({ code: "rate_limited", retryAfterSeconds }).message).toBe(
      `This demo is limited to 5 quizzes per hour. You can start again in ${wait}.`,
    );
  });

  it("still explains the limit when the wait is unknown", () => {
    expect(errorContent({ code: "rate_limited" }).message).toBe(
      "This demo is limited to 5 quizzes per hour. You can start again later.",
    );
  });

  it("offers no retry for a limit", () => {
    expect(errorContent({ code: "rate_limited", retryAfterSeconds: 60 }).action).toBe("home");
  });
});
