import { STEM_MAX_LENGTH } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { questionStem } from "./stem.js";

describe("questionStem", () => {
  it("keeps a short prompt as it is", () => {
    expect(questionStem({ prompt: "What does `typeof null` return?" })).toBe(
      "What does `typeof null` return?",
    );
  });

  it("cuts a long prompt to the stem limit", () => {
    expect(questionStem({ prompt: "a".repeat(STEM_MAX_LENGTH + 50) })).toBe(
      "a".repeat(STEM_MAX_LENGTH),
    );
  });

  it("never splits a surrogate pair", () => {
    const stem = questionStem({ prompt: `${"a".repeat(STEM_MAX_LENGTH - 1)}😀` });

    expect(stem).toBe("a".repeat(STEM_MAX_LENGTH - 1));
    expect(stem.isWellFormed()).toBe(true);
  });
});
