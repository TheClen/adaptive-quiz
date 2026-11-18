import type { AnsweredQuestion, ConceptId, QuestionKind } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { KIND_SCHEDULE } from "./schedule.js";
import { checkSessionState } from "./session-state.js";

/** `count` answers on `closures` that follow the kind schedule. */
function answers(count: number): AnsweredQuestion[] {
  return KIND_SCHEDULE.slice(0, count).map((kind, index) => ({
    kind,
    conceptId: "closures",
    correct: true,
    stem: `Question ${String(index + 1)}`,
  }));
}

function withAnswer(
  list: AnsweredQuestion[],
  index: number,
  change: { kind?: QuestionKind; conceptId?: ConceptId },
): AnsweredQuestion[] {
  return list.map((answer, i) => (i === index ? { ...answer, ...change } : answer));
}

describe("checkSessionState (plan §5)", () => {
  it("accepts a new session", () => {
    expect(checkSessionState({ topic: "javascript", answers: [] })).toEqual({ ok: true });
  });

  it("accepts every partial session that follows the schedule", () => {
    for (let count = 1; count < KIND_SCHEDULE.length; count++) {
      expect(checkSessionState({ topic: "javascript", answers: answers(count) })).toEqual({
        ok: true,
      });
    }
  });

  it("rejects a complete session", () => {
    expect(checkSessionState({ topic: "javascript", answers: answers(10) })).toEqual({
      ok: false,
      issues: [{ code: "session_complete", answers: 10 }],
    });
  });

  it("rejects an answer whose kind does not match its position", () => {
    const state = {
      topic: "javascript",
      answers: withAnswer(answers(5), 3, { kind: "single" }),
    } as const;
    expect(checkSessionState(state)).toEqual({
      ok: false,
      issues: [{ code: "kind_mismatch", position: 4, expected: "code", actual: "single" }],
    });
  });

  it("rejects a code answer at a choice position", () => {
    const state = {
      topic: "javascript",
      answers: withAnswer(answers(1), 0, { kind: "code" }),
    } as const;
    expect(checkSessionState(state)).toEqual({
      ok: false,
      issues: [{ code: "kind_mismatch", position: 1, expected: "single", actual: "code" }],
    });
  });

  it("rejects a concept of another topic", () => {
    const state = {
      topic: "javascript",
      answers: withAnswer(answers(3), 1, { conceptId: "use-effect" }),
    } as const;
    expect(checkSessionState(state)).toEqual({
      ok: false,
      issues: [{ code: "concept_not_in_topic", position: 2, conceptId: "use-effect" }],
    });
  });

  it("reports every issue, in order", () => {
    let list = answers(10);
    list = withAnswer(list, 2, { conceptId: "context" });
    list = withAnswer(list, 7, { kind: "multiple" });
    expect(checkSessionState({ topic: "javascript", answers: list })).toEqual({
      ok: false,
      issues: [
        { code: "session_complete", answers: 10 },
        { code: "concept_not_in_topic", position: 3, conceptId: "context" },
        { code: "kind_mismatch", position: 8, expected: "code", actual: "multiple" },
      ],
    });
  });
});
