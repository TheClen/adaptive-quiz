import type { NextQuestionResponse } from "@ai-in-learning/shared-types";

import screen from "./Screen.module.css";

/**
 * The question screen. For now it shows the concept and the prompt only; the
 * answer controls arrive with the choice questions (T20) and code exercises (T25).
 */
export function Question({ question }: { readonly question: NextQuestionResponse }) {
  return (
    <section className={screen.screen} aria-labelledby="question-title">
      <h1 id="question-title" className={screen.title} tabIndex={-1}>
        Question {question.position}
      </h1>
      <p className={screen.muted}>{question.conceptLabel}</p>
      <p className={screen.lead}>{question.question.prompt}</p>
    </section>
  );
}
