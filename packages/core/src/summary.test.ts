import type { AnsweredQuestion, ConceptId } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { summarize } from "./summary.js";

/** A JavaScript session following the kind schedule, one entry per question. */
function session(
  rows: readonly (readonly [conceptId: ConceptId, correct: boolean])[],
): AnsweredQuestion[] {
  const kinds = [
    "single",
    "multiple",
    "single",
    "code",
    "single",
    "multiple",
    "single",
    "code",
    "multiple",
    "single",
  ] as const;
  return rows.map(([conceptId, correct], index) => ({
    kind: kinds[index] ?? "single",
    conceptId,
    correct,
    stem: `Question ${String(index + 1)} on ${conceptId}`,
  }));
}

const ids = (concepts: readonly { id: string }[]) => concepts.map((concept) => concept.id);

describe("summarize (AC-7.1, AC-7.2)", () => {
  const answers = session([
    ["closures", true],
    ["promises", false],
    ["strings", true],
    ["array-methods", false],
    ["promises", true], // revisit, now correct: mastered
    ["modules", true],
    ["event-loop", false],
    ["array-methods", false], // revisit, still incorrect: to review
    ["closures", false], // correct earlier, incorrect now: to review
    ["event-loop", true], // revisit, now correct: mastered
  ]);
  const summary = summarize("javascript", answers);

  it("scores correct answers out of 10 (AC-7.1)", () => {
    expect(summary.score).toBe(5);
  });

  it("gives the level history and the final level (AC-7.1)", () => {
    expect(summary.levelHistory).toEqual([3, 4, 3, 4, 3, 4, 5, 4, 3, 2, 3]);
    expect(summary.finalLevel).toBe(3);
  });

  it("lists concepts by their latest attempt, in order of first appearance (AC-7.2)", () => {
    expect(ids(summary.mastered)).toEqual(["promises", "strings", "modules", "event-loop"]);
    expect(ids(summary.toReview)).toEqual(["closures", "array-methods"]);
  });

  it("lists each concept once, in exactly one list", () => {
    const all = [...ids(summary.mastered), ...ids(summary.toReview)];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(answers.map((answer) => answer.conceptId)));
  });

  it("gives the catalogue label of each concept", () => {
    expect(summary.mastered[0]).toMatchObject({ id: "promises", label: "Promises" });
  });

  it.each([
    { correct: true, score: 10, finalLevel: 5, mastered: 10, toReview: 0 },
    { correct: false, score: 0, finalLevel: 1, mastered: 0, toReview: 10 },
  ])(
    "gives score $score and level $finalLevel when every answer is $correct",
    ({ correct, score, finalLevel, mastered, toReview }) => {
      const concepts = [
        "scope-and-hoisting",
        "types-and-coercion",
        "functions",
        "closures",
        "this-binding",
        "prototypes-and-classes",
        "array-methods",
        "objects-and-destructuring",
        "immutability-and-copying",
        "strings",
      ] as const;
      const result = summarize("javascript", session(concepts.map((id) => [id, correct] as const)));
      expect(result).toMatchObject({ score, finalLevel });
      expect(result.mastered).toHaveLength(mastered);
      expect(result.toReview).toHaveLength(toReview);
    },
  );

  it("works for the React topic", () => {
    const result = summarize(
      "react",
      session([
        ["reducers", true],
        ["context", true],
        ["refs", true],
        ["reducers", true],
        ["memoization", false],
        ["use-effect", true],
        ["refs", true],
        ["events-and-forms", false],
        ["memoization", false],
        ["context", true],
      ]),
    );
    expect(ids(result.mastered)).toEqual(["reducers", "context", "refs", "use-effect"]);
    expect(ids(result.toReview)).toEqual(["memoization", "events-and-forms"]);
  });

  it("rejects an incomplete session", () => {
    expect(() => summarize("javascript", answers.slice(0, 9))).toThrow(RangeError);
  });

  it("rejects a concept from another topic", () => {
    const foreign = answers.map((answer, index) =>
      index === 0 ? { ...answer, conceptId: "reducers" as const } : answer,
    );
    expect(() => summarize("javascript", foreign)).toThrow(/does not belong/);
  });
});
