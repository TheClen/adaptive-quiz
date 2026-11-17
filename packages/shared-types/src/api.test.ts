import { describe, expect, it } from "vitest";

import {
  type AnsweredQuestion,
  CodeReview,
  CodeReviewRequest,
  CodeReviewResponse,
  NextQuestionRequest,
  NextQuestionResponse,
  SUBMITTED_CODE_MAX_LENGTH,
} from "./index.js";
import { codeExercise, sessionState, singleChoice } from "./testing/fixtures.js";

function answers(count: number): AnsweredQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: "single",
    conceptId: "closures",
    correct: true,
    stem: `Question ${String(index + 1)}`,
  }));
}

describe("NextQuestionRequest", () => {
  it("accepts a session with 0 to 9 answers", () => {
    expect(NextQuestionRequest.safeParse({ state: { ...sessionState, answers: [] } }).success).toBe(
      true,
    );
    expect(
      NextQuestionRequest.safeParse({ state: { ...sessionState, answers: answers(9) } }).success,
    ).toBe(true);
  });

  it("rejects a complete session", () => {
    expect(
      NextQuestionRequest.safeParse({ state: { ...sessionState, answers: answers(10) } }).success,
    ).toBe(false);
  });

  it("rejects a concept id from the other topic", () => {
    const state = { ...sessionState, topic: "react" };
    expect(NextQuestionRequest.safeParse({ state }).success).toBe(false);
  });
});

describe("NextQuestionResponse", () => {
  const response = {
    position: 3,
    level: 4,
    conceptId: "types-and-coercion",
    conceptLabel: "Types and coercion",
    question: singleChoice,
  };

  it("accepts a valid response", () => {
    expect(NextQuestionResponse.parse(response)).toEqual(response);
  });

  it("accepts a code exercise", () => {
    expect(
      NextQuestionResponse.safeParse({ ...response, position: 4, question: codeExercise }).success,
    ).toBe(true);
  });

  it.each([
    ["position", 0],
    ["position", 11],
    ["level", 0],
    ["level", 6],
    ["conceptId", "monads"],
    ["conceptLabel", ""],
  ])("rejects %s %j", (field, value) => {
    expect(NextQuestionResponse.safeParse({ ...response, [field]: value }).success).toBe(false);
  });
});

describe("CodeReviewRequest", () => {
  const request = {
    topic: "javascript",
    conceptId: "array-methods",
    level: 3,
    exercise: codeExercise,
    code: "function sum(numbers) {\n  let total = 0;\n  for (const n of numbers) total += n;\n  return total;\n}",
  };

  it("accepts a valid request", () => {
    expect(CodeReviewRequest.parse(request)).toEqual(request);
  });

  it(`accepts ${String(SUBMITTED_CODE_MAX_LENGTH)} characters of code and rejects more`, () => {
    const withCode = (length: number) => ({ ...request, code: "x".repeat(length) });

    expect(CodeReviewRequest.safeParse(withCode(SUBMITTED_CODE_MAX_LENGTH)).success).toBe(true);
    expect(CodeReviewRequest.safeParse(withCode(SUBMITTED_CODE_MAX_LENGTH + 1)).success).toBe(
      false,
    );
  });

  it("rejects a concept id from the other topic", () => {
    const result = CodeReviewRequest.safeParse({ ...request, conceptId: "reducers" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["conceptId"]]);
  });

  it("rejects an exercise that is not a code exercise", () => {
    expect(CodeReviewRequest.safeParse({ ...request, exercise: singleChoice }).success).toBe(false);
  });
});

describe("CodeReviewResponse", () => {
  const comment = { aspect: "readability", text: "A `reduce` call would be shorter." } as const;
  const response = { review: { summary: "Correct and clear.", comments: [comment] } };

  it("accepts a valid response", () => {
    expect(CodeReviewResponse.parse(response)).toEqual(response);
  });

  it("accepts 1 to 5 comments and rejects 0 or 6", () => {
    const withComments = (count: number) => ({
      review: { ...response.review, comments: Array.from({ length: count }, () => comment) },
    });

    expect(CodeReviewResponse.safeParse(withComments(5)).success).toBe(true);
    expect(CodeReviewResponse.safeParse(withComments(0)).success).toBe(false);
    expect(CodeReviewResponse.safeParse(withComments(6)).success).toBe(false);
  });

  it("rejects an unknown aspect and texts over 300 characters", () => {
    const withReview = (review: Record<string, unknown>) => ({
      review: { ...response.review, ...review },
    });

    expect(
      CodeReviewResponse.safeParse(withReview({ comments: [{ aspect: "style", text: "Ok" }] }))
        .success,
    ).toBe(false);
    expect(CodeReviewResponse.safeParse(withReview({ summary: "x".repeat(301) })).success).toBe(
      false,
    );
    expect(
      CodeReviewResponse.safeParse(
        withReview({ comments: [{ ...comment, text: "x".repeat(301) }] }),
      ).success,
    ).toBe(false);
  });

  describe("has no verdict (AC-6.3)", () => {
    it("declares no verdict field in the review or the response", () => {
      expect(Object.keys(CodeReview.shape)).toEqual(["summary", "comments"]);
      expect(Object.keys(CodeReviewResponse.shape)).toEqual(["review"]);
    });

    it("drops a verdict sent by the server or the model", () => {
      const parsed = CodeReviewResponse.parse({
        review: { ...response.review, verdict: "incorrect", correct: false },
        verdict: "incorrect",
      });

      expect(parsed).toEqual(response);
    });
  });
});
