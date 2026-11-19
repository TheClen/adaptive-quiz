import type { MultipleChoiceQuestion, OptionId } from "@ai-in-learning/shared-types";
import { useId } from "react";

import { ChoiceFieldset, ChoiceOption } from "./ChoiceFieldset.js";

/** The instruction that tells the visitor several answers may be correct (AC-2.2). */
export const SELECT_ALL_THAT_APPLY = "Select all that apply";

/**
 * A multiple-choice question: a fieldset of checkboxes described by "Select all
 * that apply", so several options can be selected (AC-2.2).
 */
export function MultipleChoice({
  question,
  selected,
  onChange,
}: {
  readonly question: MultipleChoiceQuestion;
  readonly selected: readonly OptionId[];
  /** Receives the selection in display order. */
  readonly onChange: (selected: OptionId[]) => void;
}) {
  const name = useId();
  return (
    <ChoiceFieldset
      prompt={question.prompt}
      snippet={question.snippet}
      instruction={SELECT_ALL_THAT_APPLY}
    >
      {question.options.map((option) => (
        <ChoiceOption
          key={option.id}
          type="checkbox"
          name={name}
          text={option.text}
          checked={selected.includes(option.id)}
          onChange={(checked) => {
            onChange(
              question.options
                .map(({ id }) => id)
                .filter((id) => (id === option.id ? checked : selected.includes(id))),
            );
          }}
        />
      ))}
    </ChoiceFieldset>
  );
}
