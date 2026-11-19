import type { LevelChange } from "@ai-in-learning/core";
import type { Level, NextQuestionResponse, OptionId } from "@ai-in-learning/shared-types";

import type { ChoiceQuestion } from "../app/sessionReducer.js";
import { CodeSnippet } from "../components/CodeSnippet.js";
import { LevelChangeNotice } from "../components/LevelChangeNotice.js";
import { VerdictIcon } from "../components/VerdictIcon.js";
import buttons from "../styles/button.module.css";
import styles from "./Feedback.module.css";
import screen from "./Screen.module.css";

/**
 * The feedback screen of a choice question (AC-6.1): the verdict in icon and
 * words, every option marked as correct or not and as chosen or not, the
 * explanation, the level change (AC-4.4) and "Next question" (AC-6.4), or
 * "See your results" after the last question.
 */
export function Feedback({
  question,
  selectedIds,
  correct,
  levelChange,
  level,
  isLast,
  onNext,
}: {
  readonly question: NextQuestionResponse & { readonly question: ChoiceQuestion };
  readonly selectedIds: readonly OptionId[];
  readonly correct: boolean;
  readonly levelChange: LevelChange;
  /** The level after the answer. */
  readonly level: Level;
  /** True after the last question: the button leads to the summary. */
  readonly isLast: boolean;
  /** Shows the next question, or the summary after the last one. */
  readonly onNext: () => void;
}) {
  const content = question.question;
  const correctIds = new Set<OptionId>(
    content.kind === "single" ? [content.correctOptionId] : content.correctOptionIds,
  );
  const selected = new Set(selectedIds);

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

      <p className={screen.lead}>{content.prompt}</p>
      {content.snippet === null ? null : <CodeSnippet snippet={content.snippet} />}

      <h2 className={styles.heading}>Answers</h2>
      <ul className={styles.options}>
        {content.options.map((option) => {
          const isCorrect = correctIds.has(option.id);
          const isSelected = selected.has(option.id);
          return (
            <li key={option.id} className={styles.option} data-correct={isCorrect}>
              <span className={styles.optionText}>{option.text}</span>
              <span className={styles.tags}>
                {isCorrect ? (
                  <span className={styles.correctTag}>
                    <VerdictIcon correct className={styles.tagIcon} />
                    Correct answer
                  </span>
                ) : null}
                {isSelected ? (
                  <span className={styles.tag}>
                    {isCorrect ? null : <VerdictIcon correct={false} className={styles.tagIcon} />}
                    Your answer
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 className={styles.heading}>Explanation</h2>
      <p className={styles.explanation}>{content.explanation}</p>

      <button type="button" className={buttons.primary} onClick={onNext}>
        {isLast ? "See your results" : "Next question"}
      </button>
    </section>
  );
}
