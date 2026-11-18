import { CodeExercise, type ExerciseTest, type Json, LIMITS } from "@ai-in-learning/shared-types";

import type { RunInput, Runner } from "../../runner/index.js";
import { questionStem } from "../../stem.js";
import type { RetryReason } from "../prompts/index.js";
import { findForbiddenConstruct } from "./code-source.js";
import type { CodeExerciseDraft } from "./drafts.js";
import { findNearDuplicate } from "./similarity.js";

/** Test counts of a code exercise (plan §7.1). */
const TEST_COUNT = { min: 3, max: 6 } as const;

const INVALID_OUTPUT = { rule: "invalid-output" } as const satisfies RetryReason;

/** The id of the test at 0-based `index`, assigned by the server. */
export function testId(index: number): string {
  return `t${String(index + 1)}`;
}

export type CodeDraftCheck =
  | { readonly ok: true; readonly tests: ExerciseTest[] }
  | { readonly ok: false; readonly reason: RetryReason };

/**
 * The function name and the test count, which the API schema requires. A draft that
 * breaks them does not have the required format.
 */
function structureRule(draft: CodeExerciseDraft): RetryReason | null {
  const count = draft.tests.length;
  if (count < TEST_COUNT.min || count > TEST_COUNT.max) return INVALID_OUTPUT;
  return CodeExercise.shape.functionName.safeParse(draft.functionName).success
    ? null
    : INVALID_OUTPUT;
}

function lengthRule(draft: CodeExerciseDraft): RetryReason | null {
  if (draft.prompt.length > LIMITS.prompt) {
    return { rule: "field-too-long", field: "prompt" };
  }
  if (draft.starterCode.length > LIMITS.code || draft.referenceSolution.length > LIMITS.code) {
    return { rule: "field-too-long", field: "code" };
  }
  if (draft.tests.some((test) => test.description.length > LIMITS.testDescription)) {
    return { rule: "field-too-long", field: "test-description" };
  }
  if (draft.explanation.length > LIMITS.explanation) {
    return { rule: "field-too-long", field: "explanation" };
  }
  return null;
}

/** The near-duplicate check (AC-5.3), as for choice drafts. */
function nearDuplicateRule(
  draft: CodeExerciseDraft,
  previousStems: readonly string[],
): RetryReason | null {
  const index = findNearDuplicate(questionStem(draft), previousStems);
  return index === -1 ? null : { rule: "near-duplicate", question: index + 1 };
}

/** Starter code and reference solution use none of the forbidden constructs (AC-3.7). */
function staticRule(draft: CodeExerciseDraft): RetryReason | null {
  const starter = findForbiddenConstruct(draft.starterCode);
  if (starter !== null) {
    return { rule: "forbidden-construct", construct: starter, in: "starter-code" };
  }
  const reference = findForbiddenConstruct(draft.referenceSolution);
  if (reference !== null) {
    return { rule: "forbidden-construct", construct: reference, in: "reference-solution" };
  }
  return null;
}

function parseJson(text: string): { readonly ok: true; readonly value: Json } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as Json };
  } catch {
    return { ok: false };
  }
}

/**
 * Parses the JSON of each test (plan §8.4 step 3): `argsJson` is a JSON array,
 * `expectedJson` a JSON value, and each test serialises to at most
 * `LIMITS.testJson` characters. Tests get the ids `t1` to `t6`, in draft order.
 */
function parseTests(draft: CodeExerciseDraft): CodeDraftCheck {
  const tests: ExerciseTest[] = [];
  for (const [index, test] of draft.tests.entries()) {
    const number = index + 1;
    const args = parseJson(test.argsJson);
    if (!args.ok) {
      return { ok: false, reason: { rule: "invalid-test-json", test: number, field: "args" } };
    }
    if (!Array.isArray(args.value)) {
      return { ok: false, reason: { rule: "args-not-array", test: number } };
    }
    const expected = parseJson(test.expectedJson);
    if (!expected.ok) {
      return {
        ok: false,
        reason: { rule: "invalid-test-json", test: number, field: "expected" },
      };
    }
    if (JSON.stringify({ args: args.value, expected: expected.value }).length > LIMITS.testJson) {
      return { ok: false, reason: { rule: "test-too-large", test: number } };
    }
    tests.push({
      id: testId(index),
      description: test.description,
      args: args.value,
      expected: expected.value,
      checksImmutability: test.checksImmutability,
    });
  }
  return { ok: true, tests };
}

/**
 * The checks of a code exercise draft that need no runner (plan §8.4 steps 2 and 3):
 * structure, field lengths, the near-duplicate check, the static checks and the test
 * JSON. Returns the parsed tests, or the first rule the draft breaks.
 */
export function checkCodeDraft(
  draft: CodeExerciseDraft,
  previousStems: readonly string[],
): CodeDraftCheck {
  const reason =
    structureRule(draft) ??
    lengthRule(draft) ??
    nearDuplicateRule(draft, previousStems) ??
    staticRule(draft);
  return reason === null ? parseTests(draft) : { ok: false, reason };
}

/**
 * The checks that run the code in the QuickJS runner (plan §8.4 step 3):
 *
 * - **Solvability (AC-3.6).** The reference solution passes every test.
 * - **Non-triviality.** The starter code fails at least one test.
 *
 * Returns the first rule the draft breaks, or `null`.
 */
export async function checkCodeRuns(
  runner: Runner,
  draft: Pick<CodeExerciseDraft, "functionName" | "starterCode" | "referenceSolution">,
  tests: RunInput["tests"],
): Promise<RetryReason | null> {
  const { functionName } = draft;
  const reference = await runner.run({ code: draft.referenceSolution, functionName, tests });
  const failed = reference.findIndex((result) => !result.passed);
  if (failed !== -1) {
    return { rule: "reference-failed", test: failed + 1 };
  }
  const starter = await runner.run({ code: draft.starterCode, functionName, tests });
  return starter.every((result) => result.passed) ? { rule: "starter-passes" } : null;
}
