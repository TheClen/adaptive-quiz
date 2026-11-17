import { describe, expect, it } from "vitest";

import { type AnsweredQuestion, SessionState, STEM_MAX_LENGTH } from "./index.js";
import { sessionState } from "./testing/fixtures.js";

function answers(count: number): AnsweredQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: "single",
    conceptId: "closures",
    correct: index % 2 === 0,
    stem: `Question ${String(index + 1)}`,
  }));
}

describe("SessionState", () => {
  it("accepts a valid state", () => {
    expect(SessionState.parse(sessionState)).toEqual(sessionState);
  });

  it("accepts a new session with no answers", () => {
    expect(SessionState.safeParse({ ...sessionState, answers: [] }).success).toBe(true);
  });

  it("accepts 10 answers and rejects 11", () => {
    expect(SessionState.safeParse({ ...sessionState, answers: answers(10) }).success).toBe(true);
    expect(SessionState.safeParse({ ...sessionState, answers: answers(11) }).success).toBe(false);
  });

  it("rejects a concept id from the other topic", () => {
    const state = {
      ...sessionState,
      answers: [
        ...sessionState.answers,
        { kind: "single", conceptId: "use-effect", correct: true, stem: "Why?" },
      ],
    };
    const result = SessionState.safeParse(state);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["answers", 2, "conceptId"]]);
  });

  it("rejects an unknown concept id", () => {
    const state = {
      ...sessionState,
      answers: [{ kind: "single", conceptId: "monads", correct: true, stem: "Why?" }],
    };
    expect(SessionState.safeParse(state).success).toBe(false);
  });

  it(`accepts a stem of ${String(STEM_MAX_LENGTH)} characters and rejects a longer one`, () => {
    const withStem = (stem: string) => ({
      ...sessionState,
      answers: [{ kind: "single", conceptId: "closures", correct: true, stem }],
    });

    expect(SessionState.safeParse(withStem("x".repeat(STEM_MAX_LENGTH))).success).toBe(true);
    expect(SessionState.safeParse(withStem("x".repeat(STEM_MAX_LENGTH + 1))).success).toBe(false);
  });

  it("rejects an empty stem and an unknown kind", () => {
    const withAnswer = (answer: Record<string, unknown>) => ({
      ...sessionState,
      answers: [{ kind: "single", conceptId: "closures", correct: true, stem: "Why?", ...answer }],
    });

    expect(SessionState.safeParse(withAnswer({ stem: "" })).success).toBe(false);
    expect(SessionState.safeParse(withAnswer({ kind: "essay" })).success).toBe(false);
  });

  it("rejects another version or topic", () => {
    expect(SessionState.safeParse({ ...sessionState, version: 2 }).success).toBe(false);
    expect(SessionState.safeParse({ ...sessionState, topic: "vue" }).success).toBe(false);
  });

  it.each([0, 0xffff_ffff])("accepts seed %d", (seed) => {
    expect(SessionState.safeParse({ ...sessionState, seed }).success).toBe(true);
  });

  it.each([-1, 0x1_0000_0000, 1.5])("rejects seed %d", (seed) => {
    expect(SessionState.safeParse({ ...sessionState, seed }).success).toBe(false);
  });
});
