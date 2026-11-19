import type { Snippet } from "@ai-in-learning/shared-types";
import { type ReactNode, useId } from "react";

import styles from "./Choice.module.css";
import { CodeSnippet } from "./CodeSnippet.js";

/**
 * The fieldset of a choice question: the prompt as its legend, the snippet, an
 * optional instruction that describes the group, then the options (plan §13.3).
 */
export function ChoiceFieldset({
  prompt,
  snippet,
  instruction,
  children,
}: {
  readonly prompt: string;
  readonly snippet: Snippet | null;
  /** Visible text read with the group's name, for example "Select all that apply". */
  readonly instruction?: string;
  readonly children: ReactNode;
}) {
  const instructionId = useId();
  return (
    <fieldset
      className={styles.fieldset}
      {...(instruction === undefined ? {} : { "aria-describedby": instructionId })}
    >
      <legend className={styles.legend}>{prompt}</legend>
      {snippet === null ? null : <CodeSnippet snippet={snippet} />}
      {instruction === undefined ? null : (
        <p id={instructionId} className={styles.instruction}>
          {instruction}
        </p>
      )}
      <div className={styles.options}>{children}</div>
    </fieldset>
  );
}

/** One option: a native input and its text, the whole row clickable. */
export function ChoiceOption({
  type,
  name,
  text,
  checked,
  onChange,
}: {
  readonly type: "radio" | "checkbox";
  readonly name: string;
  readonly text: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.option}>
      <input
        className={styles.input}
        type={type}
        name={name}
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span>{text}</span>
    </label>
  );
}
