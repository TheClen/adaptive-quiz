import type {
  MultipleChoiceQuestion,
  OptionId,
  SingleChoiceQuestion,
} from "@ai-in-learning/shared-types";

/** The outcome of one test of a code exercise, as the runner reports it. */
export interface TestOutcome {
  readonly passed: boolean;
}

/**
 * True only when the selected options are exactly the correct ones (AC-2.4).
 *
 * A partial selection, a superset of the correct options and an empty selection are
 * all incorrect. The order of `selectedIds` does not matter.
 */
export function evaluateChoice(
  question: SingleChoiceQuestion | MultipleChoiceQuestion,
  selectedIds: readonly OptionId[],
): boolean {
  const correct = new Set<OptionId>(
    question.kind === "single" ? [question.correctOptionId] : question.correctOptionIds,
  );
  const selected = new Set(selectedIds);
  return selected.size === correct.size && [...selected].every((id) => correct.has(id));
}

/**
 * True only when every test passed (AC-3.3).
 *
 * An empty list is incorrect: an exercise always has tests, so no results means the
 * code was not run.
 */
export function evaluateCode(testResults: readonly TestOutcome[]): boolean {
  return testResults.length > 0 && testResults.every((result) => result.passed);
}
