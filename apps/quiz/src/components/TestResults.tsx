import type { TestResult } from "@ai-in-learning/core/runner";
import type { ExerciseTest } from "@ai-in-learning/shared-types";

import styles from "./TestResults.module.css";
import { VerdictIcon } from "./VerdictIcon.js";

/** The words of a run, for example "2 of 3 tests passed" (AC-3.2). */
export function testSummary(results: readonly TestResult[]): string {
  const passed = results.filter((result) => result.passed).length;
  const total = results.length;
  if (passed === total) {
    return total === 1 ? "The test passed" : `All ${String(total)} tests passed`;
  }
  return `${String(passed)} of ${String(total)} ${total === 1 ? "test" : "tests"} passed`;
}

/**
 * The tests of an exercise: what each one checks (AC-3.1) and, once they have
 * run, whether it passed, with the reason when it failed (AC-3.2). Pass and fail
 * are written next to their icon, never shown by colour alone (plan §13.3).
 *
 * The outcome of a run is announced in a polite live region, which is rendered
 * empty before the first run so that screen readers pick up its first message.
 */
export function TestResults({
  tests,
  results,
  running = false,
}: {
  readonly tests: readonly ExerciseTest[];
  /** The results of the latest run, or `null` before the first one. */
  readonly results: readonly TestResult[] | null;
  /** True while a run is in progress; the previous results stay shown until it ends. */
  readonly running?: boolean;
}) {
  const byId = new Map(results?.map((result) => [result.testId, result]));
  let status: string | null = null;
  if (running) {
    status = "Running tests…";
  } else if (results !== null) {
    status = testSummary(results);
  }

  return (
    <div className={styles.results}>
      <p role="status" className={status === null ? styles.empty : styles.summary}>
        {status}
      </p>
      <ul className={styles.tests}>
        {tests.map((test) => {
          const result = byId.get(test.id);
          return (
            <li key={test.id} className={styles.test} data-passed={result?.passed}>
              <span className={styles.description}>{test.description}</span>
              {result === undefined ? null : result.passed ? (
                <span className={styles.passed}>
                  <VerdictIcon correct className={styles.icon} />
                  Passed
                </span>
              ) : (
                <>
                  <span className={styles.failed}>
                    <VerdictIcon correct={false} className={styles.icon} />
                    Failed
                  </span>
                  <span className={styles.reason}>{result.reason}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
