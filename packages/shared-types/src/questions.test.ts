import { describe, expect, it } from "vitest";

import { Json, LIMITS, type Option, Question } from "./index.js";
import { codeExercise, multipleChoice, singleChoice } from "./testing/fixtures.js";

const optionIds = ["a", "b", "c", "d", "e", "f", "g"] as const;

function options(count: number): Option[] {
  return optionIds.slice(0, count).map((id) => ({ id, text: `Option ${id}` })) as Option[];
}

function accepts(value: unknown): boolean {
  return Question.safeParse(value).success;
}

describe("Question", () => {
  it.each([
    ["single", singleChoice],
    ["multiple", multipleChoice],
    ["code", codeExercise],
  ])("accepts a valid %s question", (_, question) => {
    expect(Question.parse(question)).toEqual(question);
  });

  it("rejects an unknown kind", () => {
    expect(accepts({ ...singleChoice, kind: "essay" })).toBe(false);
  });
});

describe("single choice (AC-2.1)", () => {
  it.each([3, 5])("rejects %d options", (count) => {
    expect(accepts({ ...singleChoice, options: options(count), correctOptionId: "a" })).toBe(false);
  });

  it("rejects a correct option that is not among the options", () => {
    expect(accepts({ ...singleChoice, correctOptionId: "e" })).toBe(false);
  });

  it("rejects several correct options", () => {
    expect(accepts({ ...singleChoice, correctOptionId: ["a", "b"] })).toBe(false);
  });

  it("rejects duplicate option ids", () => {
    const [first, second, third] = singleChoice.options;
    expect(
      accepts({ ...singleChoice, options: [first, second, third, { ...first, text: "Other" }] }),
    ).toBe(false);
  });

  it("rejects an option id outside a to f", () => {
    const [first, second, third] = singleChoice.options;
    expect(
      accepts({ ...singleChoice, options: [first, second, third, { id: "z", text: "Other" }] }),
    ).toBe(false);
  });
});

describe("multiple choice (AC-2.2)", () => {
  it.each([4, 6])("accepts %d options", (count) => {
    expect(
      accepts({ ...multipleChoice, options: options(count), correctOptionIds: ["a", "b"] }),
    ).toBe(true);
  });

  it.each([3, 7])("rejects %d options", (count) => {
    expect(
      accepts({ ...multipleChoice, options: options(count), correctOptionIds: ["a", "b"] }),
    ).toBe(false);
  });

  it("rejects a single correct option", () => {
    expect(accepts({ ...multipleChoice, correctOptionIds: ["a"] })).toBe(false);
  });

  it("rejects a question where every option is correct", () => {
    expect(accepts({ ...multipleChoice, correctOptionIds: ["a", "b", "c", "d"] })).toBe(false);
  });

  it("rejects a correct option that is not among the options", () => {
    expect(accepts({ ...multipleChoice, correctOptionIds: ["a", "e"] })).toBe(false);
  });

  it("rejects a correct option listed twice", () => {
    expect(accepts({ ...multipleChoice, correctOptionIds: ["a", "a"] })).toBe(false);
  });
});

describe("choice question fields", () => {
  it(`rejects a prompt over ${String(LIMITS.prompt)} characters`, () => {
    expect(accepts({ ...singleChoice, prompt: "x".repeat(LIMITS.prompt) })).toBe(true);
    expect(accepts({ ...singleChoice, prompt: "x".repeat(LIMITS.prompt + 1) })).toBe(false);
  });

  it(`rejects an option text over ${String(LIMITS.optionText)} characters`, () => {
    const [first, ...rest] = singleChoice.options;
    const withText = (text: string) => ({
      ...singleChoice,
      options: [{ ...first, text }, ...rest],
    });

    expect(accepts(withText("x".repeat(LIMITS.optionText)))).toBe(true);
    expect(accepts(withText("x".repeat(LIMITS.optionText + 1)))).toBe(false);
  });

  it(`rejects an explanation over ${String(LIMITS.explanation)} characters`, () => {
    expect(accepts({ ...singleChoice, explanation: "x".repeat(LIMITS.explanation + 1) })).toBe(
      false,
    );
  });

  it("accepts a jsx snippet and no snippet, and rejects another language", () => {
    expect(accepts({ ...singleChoice, snippet: { language: "jsx", source: "<App />" } })).toBe(
      true,
    );
    expect(accepts({ ...singleChoice, snippet: null })).toBe(true);
    expect(
      accepts({ ...singleChoice, snippet: { language: "typescript", source: "let x: number;" } }),
    ).toBe(false);
  });

  it("requires the snippet field to be present", () => {
    const withoutSnippet: Record<string, unknown> = { ...singleChoice };
    delete withoutSnippet.snippet;
    expect(accepts(withoutSnippet)).toBe(false);
  });
});

describe("code exercise", () => {
  const [test1, test2, test3] = codeExercise.tests;
  const extraTests = ["t4", "t5", "t6", "t7"].map((id) => ({ ...test1, id }));

  it("accepts 6 tests and rejects 2 or 7", () => {
    expect(
      accepts({ ...codeExercise, tests: [test1, test2, test3, ...extraTests.slice(0, 3)] }),
    ).toBe(true);
    expect(accepts({ ...codeExercise, tests: [test1, test2] })).toBe(false);
    expect(accepts({ ...codeExercise, tests: [test1, test2, test3, ...extraTests] })).toBe(false);
  });

  it("rejects duplicate test ids", () => {
    expect(accepts({ ...codeExercise, tests: [test1, test2, { ...test3, id: "t1" }] })).toBe(false);
  });

  it.each(["Sum", "1sum", "sum-all", "sum all", ""])(
    "rejects the function name %j",
    (functionName) => {
      expect(accepts({ ...codeExercise, functionName })).toBe(false);
    },
  );

  it(`rejects starter code or a reference solution over ${String(LIMITS.code)} characters`, () => {
    const oversized = "x".repeat(LIMITS.code + 1);
    expect(accepts({ ...codeExercise, starterCode: oversized })).toBe(false);
    expect(accepts({ ...codeExercise, referenceSolution: oversized })).toBe(false);
  });

  it(`rejects a test whose JSON exceeds ${String(LIMITS.testJson)} characters`, () => {
    const big = { ...test1, args: ["x".repeat(LIMITS.testJson)] };
    expect(accepts({ ...codeExercise, tests: [big, test2, test3] })).toBe(false);
  });

  it("rejects test values that are not JSON", () => {
    const withUndefined = { ...test1, expected: undefined };
    const withFunction = { ...test1, args: [() => 1] };

    expect(accepts({ ...codeExercise, tests: [withUndefined, test2, test3] })).toBe(false);
    expect(accepts({ ...codeExercise, tests: [withFunction, test2, test3] })).toBe(false);
  });

  it("rejects a missing exercise token", () => {
    expect(accepts({ ...codeExercise, exerciseToken: "" })).toBe(false);
  });
});

describe("Json", () => {
  it.each([null, true, 1.5, "text", [], {}, { nested: [1, { deep: null }] }])(
    "accepts %j",
    (value) => {
      expect(Json.safeParse(value).success).toBe(true);
    },
  );

  it.each([undefined, Number.NaN, () => 1, new Date(0)])("rejects %s", (value) => {
    expect(Json.safeParse(value).success).toBe(false);
  });
});
