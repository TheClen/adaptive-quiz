import type { Snippet } from "@ai-in-learning/shared-types";
import { useMemo } from "react";

import styles from "./CodeSnippet.module.css";
import { highlightSnippet } from "./highlight.js";

const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  jsx: "JSX",
} as const satisfies Record<Snippet["language"], string>;

/**
 * A read-only code snippet with static syntax highlighting (AC-2.5). Long lines
 * scroll rather than wrap, so the snippet takes keyboard focus to be scrolled
 * (WCAG 2.1.1).
 */
export function CodeSnippet({ snippet }: { readonly snippet: Snippet }) {
  const segments = useMemo(() => highlightSnippet(snippet), [snippet]);
  return (
    <pre
      className={styles.snippet}
      role="group"
      aria-label={`Code snippet, ${LANGUAGE_LABELS[snippet.language]}`}
      tabIndex={0}
    >
      <code>
        {segments.map((segment, index) =>
          segment.classes === "" ? (
            segment.text
          ) : (
            <span key={index} className={segment.classes}>
              {segment.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
