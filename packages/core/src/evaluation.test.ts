import type {
  MultipleChoiceQuestion,
  OptionId,
  SingleChoiceQuestion,
} from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { evaluateChoice, evaluateCode } from "./evaluation.js";

const singleChoice = {
  kind: "single",
  prompt: "What does `typeof null` return?",
  snippet: null,
  options: [
    { id: "a", text: '"null"' },
    { id: "b", text: '"object"' },
    { id: "c", text: '"undefined"' },
    { id: "d", text: "It throws a TypeError" },
  ],
  correctOptionId: "b",
  explanation: '`typeof null` is `"object"`.',
} satisfies SingleChoiceQuestion;

const multipleChoice = {
  kind: "multiple",
  prompt: "Which of these create a block scope?",
  snippet: null,
  options: [
    { id: "a", text: "An `if` block" },
    { id: "b", text: "A `for` loop with `let`" },
    { id: "c", text: "An object literal" },
    { id: "d", text: "A bare `{}` block" },
  ],
  correctOptionIds: ["a", "b", "d"],
  explanation: "Blocks create scopes for `let` and `const`; object literals do not.",
} satisfies MultipleChoiceQuestion;

describe("evaluateChoice on a single-choice question", () => {
  // The correct option is "b".
  it.each<{ selected: OptionId[]; expected: boolean; case: string }>([
    { selected: ["b"], expected: true, case: "the correct option" },
    { selected: ["a"], expected: false, case: "a wrong option" },
    { selected: [], expected: false, case: "nothing" },
    { selected: ["a", "b"], expected: false, case: "the correct option and a wrong one" },
  ])("is $expected for $case", ({ selected, expected }) => {
    expect(evaluateChoice(singleChoice, selected)).toBe(expected);
  });
});

describe("evaluateChoice on a multiple-choice question (AC-2.4)", () => {
  // The correct options are "a", "b" and "d"; "c" is wrong.
  it.each<{ selected: OptionId[]; expected: boolean; case: string }>([
    { selected: ["a", "b", "d"], expected: true, case: "exact set" },
    { selected: ["d", "a", "b"], expected: true, case: "exact set in another order" },
    { selected: ["a", "b"], expected: false, case: "partial set" },
    { selected: ["a"], expected: false, case: "a single correct option" },
    { selected: ["a", "b", "c", "d"], expected: false, case: "superset" },
    { selected: ["a", "b", "c"], expected: false, case: "partial set with a wrong option" },
    { selected: ["c"], expected: false, case: "only the wrong option" },
    { selected: [], expected: false, case: "empty selection" },
  ])("is $expected for the $case", ({ selected, expected }) => {
    expect(evaluateChoice(multipleChoice, selected)).toBe(expected);
  });

  it("is false for an option that is not part of the question", () => {
    const question = {
      ...multipleChoice,
      correctOptionIds: ["a", "b"],
    } satisfies MultipleChoiceQuestion;
    expect(evaluateChoice(question, ["a", "b", "f"])).toBe(false);
  });
});

describe("evaluateCode (AC-3.3)", () => {
  const pass = { passed: true };
  const fail = { passed: false };

  it.each([
    { results: [pass, pass, pass], expected: true, case: "every test passed" },
    { results: [pass, pass, fail], expected: false, case: "the last test failed" },
    { results: [fail, pass, pass], expected: false, case: "the first test failed" },
    { results: [fail, fail, fail], expected: false, case: "every test failed" },
    { results: [], expected: false, case: "there are no results" },
  ])("is $expected when $case", ({ results, expected }) => {
    expect(evaluateCode(results)).toBe(expected);
  });
});
