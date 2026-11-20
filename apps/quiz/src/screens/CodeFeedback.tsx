import type { LevelChange } from "@ai-in-learning/core";
import type { TestResult } from "@ai-in-learning/core/runner";
import type { Level } from "@ai-in-learning/shared-types";

import type { CodeQuestionResponse, ReviewStatus } from "../app/sessionReducer.js";
import { CodeEditor } from "../components/CodeEditor.js";
import { CodeReviewPanel } from "../components/CodeReviewPanel.js";
import { LevelChangeNotice } from "../components/LevelChangeNotice.js";
import { TestResults } from "../components/TestResults.js";
import { VerdictIcon } from "../components/VerdictIcon.js";
import buttons from "../styles/button.module.css";
import styles from "./Feedback.module.css";
import screen from "./Screen.module.css";

/**
 * The feedback screen of a code exercise (AC-6.2): the verdict, the test results,
 * the submitted code and the reference solution at once, then the AI review when
 * it arrives. The verdict is the one the tests gave (AC-6.3), and "Next question"
 * is available whatever state the review is in (plan §10).
 */
export function CodeFeedback({
  question,
  code,
  testResults,
  correct,
  levelChange,
  level,
  review,
  isLast,
  onNext,
  onRetryReview,
}: {
  readonly question: CodeQuestionResponse;
  readonly code: string;
  /** The results of the final run. */
  readonly testResults: readonly TestResult[];
  /** The verdict recorded from the tests. */
  readonly correct: boolean;
  readonly levelChange: LevelChange;
  /** The level after the answer. */
  readonly level: Level;
  readonly review: ReviewStatus;
  /** True after the last question: the button leads to the summary. */
  readonly isLast: boolean;
  /** Shows the next question, or the summary after the last one. */
  readonly onNext: () => void;
  readonly onRetryReview: () => void;
}) {
  const exercise = question.question;

  return (
    <section className={screen.screen} aria-labelledby="feedback-title">
      <p className={screen.muted}>
        Question {question.position} · {question.conceptLabel}
      </p>
      <h1 id="feedback-title" className={styles.verdict} data-correct={correct} tabIndex={-1}>
        <VerdictIcon correct={correct} className={styles.verdictIcon} />
        {correct ? "Correct" : "Incorrect"}
      </h1>
      <LevelChangeNotice change={levelChange} level={level} />

      <p className={screen.lead}>{exercise.prompt}</p>

      <h2 className={styles.heading}>Test results</h2>
      <TestResults tests={exercise.tests} results={testResults} />

      <CodeEditor initialCode={code} readOnly label="Your solution" />
      <CodeEditor initialCode={exercise.referenceSolution} readOnly label="Reference solution" />

      <h2 className={styles.heading}>Explanation</h2>
      <p className={styles.explanation}>{exercise.explanation}</p>

      <CodeReviewPanel review={review} onRetry={onRetryReview} />

      <button type="button" className={buttons.primary} onClick={onNext}>
        {isLast ? "See your results" : "Next question"}
      </button>
    </section>
  );
}
