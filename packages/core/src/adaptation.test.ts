import { describe, expect, it } from "vitest";

import { levelChange, levelHistory } from "./adaptation.js";

/** Answers from a string: `1` for correct, `0` for incorrect. */
function answers(pattern: string): { correct: boolean }[] {
  return Array.from(pattern, (char) => ({ correct: char === "1" }));
}

describe("levelHistory (AC-4.1 to AC-4.3)", () => {
  it("starts at level 3 before the first answer (AC-4.1)", () => {
    expect(levelHistory([])).toEqual([3]);
  });

  it.each([
    { pattern: "1", expected: [3, 4], rule: "a correct answer adds 1 (AC-4.2)" },
    { pattern: "0", expected: [3, 2], rule: "an incorrect answer subtracts 1 (AC-4.3)" },
    { pattern: "111", expected: [3, 4, 5, 5], rule: "the level stays at 5 at most (AC-4.2)" },
    { pattern: "000", expected: [3, 2, 1, 1], rule: "the level stays at 1 at least (AC-4.3)" },
    { pattern: "11110", expected: [3, 4, 5, 5, 5, 4], rule: "a miss at the top goes down to 4" },
    {
      pattern: "00001",
      expected: [3, 2, 1, 1, 1, 2],
      rule: "a success at the bottom goes up to 2",
    },
    { pattern: "1010", expected: [3, 4, 3, 4, 3], rule: "alternating answers oscillate" },
  ])("$rule: $pattern gives $expected", ({ pattern, expected }) => {
    expect(levelHistory(answers(pattern))).toEqual(expected);
  });

  it("returns 11 values for a complete session: before each question, then the final level", () => {
    expect(levelHistory(answers("1101001110"))).toEqual([3, 4, 5, 4, 5, 4, 3, 4, 5, 5, 4]);
  });

  it("gives identical levels for identical answers (AC-4.5)", () => {
    const pattern = "0110100111";
    expect(levelHistory(answers(pattern))).toEqual(levelHistory(answers(pattern)));
  });

  it("depends only on correctness, not on the question content (AC-4.5)", () => {
    const first = [
      { kind: "single", conceptId: "closures", correct: true, stem: "First stem" },
      { kind: "multiple", conceptId: "promises", correct: false, stem: "Second stem" },
    ] as const;
    const second = [
      { kind: "single", conceptId: "modules", correct: true, stem: "Another stem" },
      { kind: "multiple", conceptId: "strings", correct: false, stem: "Yet another stem" },
    ] as const;
    expect(levelHistory(first)).toEqual(levelHistory(second));
  });
});

describe("levelChange (AC-4.4)", () => {
  it.each([
    { pattern: "", expected: "none", when: "before the first answer" },
    { pattern: "1", expected: "up", when: "after a correct answer" },
    { pattern: "0", expected: "down", when: "after an incorrect answer" },
    { pattern: "111", expected: "none", when: "after a correct answer at level 5" },
    { pattern: "000", expected: "none", when: "after an incorrect answer at level 1" },
    { pattern: "110", expected: "down", when: "after a miss that follows successes" },
    { pattern: "001", expected: "up", when: "after a success that follows misses" },
  ])("is $expected $when", ({ pattern, expected }) => {
    expect(levelChange(answers(pattern))).toBe(expected);
  });
});
