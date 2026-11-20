import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, lineNumbers } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { useEffect, useId, useRef, useState } from "react";

import styles from "./CodeEditor.module.css";

export const EDITABLE_HINT = "Press Esc then Tab to leave the editor.";
export const READ_ONLY_HINT = "This code is read-only.";

export interface CodeEditorProps {
  /**
   * The code the editor starts with. Later changes are ignored: render the editor
   * with a `key` per exercise to start again from new code.
   */
  readonly initialCode: string;
  /** Receives the whole code after each change. */
  readonly onChange?: (code: string) => void;
  /** Freezes the code, for example once the exercise is submitted (AC-3.3). */
  readonly readOnly?: boolean;
  /** The visible label, which is also the accessible name of the editable area. */
  readonly label?: string;
}

/**
 * A JavaScript code editor on CodeMirror 6 (plan §9.5, AC-3.1).
 *
 * Tab indents. Pressing Escape, then Tab within two seconds, moves focus out of
 * the editor, as the visible hint says, so focus is never trapped (NFR-2). In
 * read-only mode Tab does not indent and moves focus straight out.
 */
export function CodeEditor({
  initialCode,
  onChange,
  readOnly = false,
  label = "Your solution",
}: CodeEditorProps) {
  const labelId = useId();
  const hintId = useId();
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [readOnlyCompartment] = useState(() => new Compartment());
  const onChangeRef = useRef(onChange);
  const initialRef = useRef({ initialCode, readOnly });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const parent = parentRef.current;
    if (parent === null) {
      return;
    }
    const initial = initialRef.current;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: initial.initialCode,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          EditorState.tabSize.of(2),
          indentUnit.of("  "),
          javascript(),
          syntaxHighlighting(classHighlighter),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          readOnlyCompartment.of(EditorState.readOnly.of(initial.readOnly)),
          EditorView.contentAttributes.of({
            "aria-labelledby": labelId,
            "aria-describedby": hintId,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [labelId, hintId, readOnlyCompartment]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly, readOnlyCompartment]);

  return (
    <div className={styles.field}>
      <div id={labelId} className={styles.label}>
        {label}
      </div>
      <div ref={parentRef} className={styles.editor} />
      <p id={hintId} className={styles.hint}>
        {readOnly ? READ_ONLY_HINT : EDITABLE_HINT}
      </p>
    </div>
  );
}
