import type { TestResult } from "@ai-in-learning/core/runner";
import {
  type CodeExercise as CodeExerciseContent,
  SUBMITTED_CODE_MAX_LENGTH,
} from "@ai-in-learning/shared-types";
import { useEffect, useRef, useState } from "react";

import { useRunner } from "../app/RunnerContext.js";
import screen from "../screens/Screen.module.css";
import buttons from "../styles/button.module.css";
import { CodeEditor } from "./CodeEditor.js";
import styles from "./CodeExercise.module.css";
import { SubmitButton } from "./SubmitButton.js";
import { TestResults } from "./TestResults.js";

export const TOO_LONG_HINT = `Shorten your code to ${SUBMITTED_CODE_MAX_LENGTH.toLocaleString("en")} characters or fewer to submit it.`;

/** What the exercise is doing: the visitor edits, a run is in progress, or the final run is. */
type Phase = "editing" | "running" | "submitting";

/**
 * A code exercise (AC-3.1 to AC-3.3, plan §9.4): the statement, an editor with
 * the starter code, what the tests check, "Run tests" and Submit.
 *
 * - "Run tests" runs every test in the runner worker; the results replace the
 *   previous ones, as many times as the visitor wants (AC-3.2).
 * - Submit freezes the editor, runs the tests one last time and hands the code
 *   and those results to `onSubmit`, which records the verdict (AC-3.3).
 *
 * Render it with a `key` per exercise, so the code starts from the starter code.
 */
export function CodeExercise({
  exercise,
  onSubmit,
}: {
  readonly exercise: CodeExerciseContent;
  /** Receives the submitted code and the results of its final run. Called once. */
  readonly onSubmit: (code: string, testResults: readonly TestResult[]) => void;
}) {
  const runner = useRunner();
  const [code, setCode] = useState(exercise.starterCode);
  const [results, setResults] = useState<readonly TestResult[] | null>(null);
  const [phase, setPhase] = useState<Phase>("editing");
  const lastRun = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const tooLong = code.length > SUBMITTED_CODE_MAX_LENGTH;

  function run(final: boolean): void {
    const runId = ++lastRun.current;
    const runCode = code;
    setPhase(final ? "submitting" : "running");
    void runner
      .run({ code: runCode, functionName: exercise.functionName, tests: exercise.tests })
      .then((testResults) => {
        // A later run, or leaving the exercise, makes these results stale.
        if (!mounted.current || runId !== lastRun.current) {
          return;
        }
        setResults(testResults);
        if (final) {
          onSubmit(runCode, testResults);
        } else {
          setPhase("editing");
        }
      });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (phase !== "submitting" && !tooLong) {
          run(true);
        }
      }}
    >
      <p className={screen.lead}>{exercise.prompt}</p>
      <CodeEditor
        initialCode={exercise.starterCode}
        onChange={setCode}
        readOnly={phase === "submitting"}
      />

      <h2 className={styles.heading}>What the tests check</h2>
      <TestResults tests={exercise.tests} results={results} running={phase !== "editing"} />

      <div className={styles.actions}>
        <button
          type="button"
          className={buttons.secondary}
          aria-disabled={phase !== "editing"}
          onClick={() => {
            if (phase === "editing") {
              run(false);
            }
          }}
        >
          Run tests
        </button>
        <SubmitButton blocked={tooLong} hint={TOO_LONG_HINT} />
      </div>
    </form>
  );
}
