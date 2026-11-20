import type { TestResult } from "@ai-in-learning/core/runner";
import type { NextQuestionResponse, OptionId } from "@ai-in-learning/shared-types";
import { useState } from "react";

import { CodeExercise } from "../components/CodeExercise.js";
import { MultipleChoice } from "../components/MultipleChoice.js";
import { SingleChoice } from "../components/SingleChoice.js";
import { SubmitButton } from "../components/SubmitButton.js";
import screen from "./Screen.module.css";

/**
 * The question screen. Choice questions show their options and Submit; code
 * exercises show the editor, the tests and Submit.
 *
 * Render it with a `key` per question, so the selection or the code starts
 * afresh each time.
 */
export function Question({
  question,
  onSubmit,
  onSubmitCode,
}: {
  readonly question: NextQuestionResponse;
  /** Receives the selected option ids, in display order, never empty (AC-2.3). */
  readonly onSubmit: (selectedIds: OptionId[]) => void;
  /** Receives the submitted code and the results of its final run (AC-3.3). */
  readonly onSubmitCode: (code: string, testResults: readonly TestResult[]) => void;
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
        <CodeExercise exercise={content} onSubmit={onSubmitCode} />
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
