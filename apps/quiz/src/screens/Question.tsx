import type { NextQuestionResponse, OptionId } from "@ai-in-learning/shared-types";
import { useState } from "react";

import { MultipleChoice } from "../components/MultipleChoice.js";
import { SingleChoice } from "../components/SingleChoice.js";
import { SubmitButton } from "../components/SubmitButton.js";
import screen from "./Screen.module.css";

/**
 * The question screen. Choice questions show their options and Submit; code
 * exercises show their prompt only until the exercise screen arrives (T25).
 *
 * Render it with a `key` per question, so the selection starts empty each time.
 */
export function Question({
  question,
  onSubmit,
}: {
  readonly question: NextQuestionResponse;
  /** Receives the selected option ids, in display order, never empty (AC-2.3). */
  readonly onSubmit: (selectedIds: OptionId[]) => void;
}) {
  const [selected, setSelected] = useState<OptionId[]>([]);
  const content = question.question;

  return (
    <section className={screen.screen} aria-labelledby="question-title">
      <h1 id="question-title" className={screen.title} tabIndex={-1}>
        Question {question.position}
      </h1>
      <p className={screen.muted}>{question.conceptLabel}</p>
      {content.kind === "code" ? (
        <p className={screen.lead}>{content.prompt}</p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (selected.length > 0) {
              onSubmit(selected);
            }
          }}
        >
          {content.kind === "single" ? (
            <SingleChoice
              question={content}
              selected={selected[0] ?? null}
              onChange={(id) => {
                setSelected([id]);
              }}
            />
          ) : (
            <MultipleChoice question={content} selected={selected} onChange={setSelected} />
          )}
          <SubmitButton
            blocked={selected.length === 0}
            hint={
              content.kind === "single"
                ? "Select an answer to submit."
                : "Select at least one answer to submit."
            }
          />
        </form>
      )}
    </section>
  );
}
