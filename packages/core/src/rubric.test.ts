import { describe, expect, it } from "vitest";

import { DIFFICULTY_RUBRIC, rubricLine } from "./rubric.js";

describe("difficulty rubric", () => {
  it("has five levels, as in plan §8.3", () => {
    expect(DIFFICULTY_RUBRIC).toEqual([
      "basic syntax and behaviour",
      "common usage",
      "typical pitfalls",
      "edge cases and interactions between features",
      "subtle semantics, performance and design trade-offs",
    ]);
  });

  it.each([
    [1, "basic syntax and behaviour"],
    [3, "typical pitfalls"],
    [5, "subtle semantics, performance and design trade-offs"],
  ])("gives the line of level %d", (level, line) => {
    expect(rubricLine(level)).toBe(line);
  });

  it.each([0, 6, 2.5, Number.NaN])("rejects level %d", (level) => {
    expect(() => rubricLine(level)).toThrow(RangeError);
  });
});
