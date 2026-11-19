import type { OptionId, SingleChoiceQuestion } from "@ai-in-learning/shared-types";
import { useId } from "react";

import { ChoiceFieldset, ChoiceOption } from "./ChoiceFieldset.js";

/**
 * A single-choice question: a native radio group, so only one option can be
 * selected and arrow keys move between options (AC-2.1).
 */
export function SingleChoice({
  question,
  selected,
  onChange,
}: {
  readonly question: SingleChoiceQuestion;
  readonly selected: OptionId | null;
  readonly onChange: (selected: OptionId) => void;
}) {
  const name = useId();
  return (
    <ChoiceFieldset prompt={question.prompt} snippet={question.snippet}>
      {question.options.map((option) => (
        <ChoiceOption
          key={option.id}
          type="radio"
          name={name}
          text={option.text}
          checked={selected === option.id}
          onChange={(checked) => {
            if (checked) {
              onChange(option.id);
            }
          }}
        />
      ))}
    </ChoiceFieldset>
  );
}
