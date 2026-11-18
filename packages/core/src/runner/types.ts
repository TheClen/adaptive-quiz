import type { CodeExercise } from "@ai-in-learning/shared-types";

import type { TestOutcome } from "../evaluation.js";

/** What one run needs: the code to test, and the exercise's function name and tests. */
export interface RunInput extends Pick<CodeExercise, "functionName" | "tests"> {
  readonly code: string;
}

/** The result of one test. A failed test carries a reason from a fixed template. */
export type TestResult =
  | (TestOutcome & { readonly testId: string; readonly passed: true })
  | (TestOutcome & { readonly testId: string; readonly passed: false; readonly reason: string });

/** Limits applied to every run (plan §9.2). */
export interface RunLimits {
  /** Time for the whole run, all tests included. */
  readonly timeoutMs: number;
  readonly memoryBytes: number;
  readonly stackBytes: number;
}
