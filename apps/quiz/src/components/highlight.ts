import { classHighlighter, highlightCode, tagHighlighter, tags } from "@lezer/highlight";
import { parser } from "@lezer/javascript";
import type { Snippet } from "@ai-in-learning/shared-types";

/** A run of source text with the highlighting classes of its token, if any. */
export interface HighlightedSegment {
  readonly text: string;
  /** Space-separated `tok-*` classes, or `""` for text that is not a token. */
  readonly classes: string;
}

const parsers = {
  javascript: parser,
  jsx: parser.configure({ dialect: "jsx" }),
} as const satisfies Record<Snippet["language"], typeof parser>;

/**
 * `classHighlighter` has no class of its own for JSX tag and attribute names; these
 * add one to the class of their parent tag (`typeName`, `propertyName`).
 */
const jsxHighlighter = tagHighlighter([
  { tag: tags.tagName, class: "tok-tagName" },
  { tag: tags.attributeName, class: "tok-attributeName" },
]);

/**
 * Splits a snippet into segments with the CodeMirror JavaScript grammar, so read-only
 * snippets and the code editor highlight the same way (plan §9.5, AC-2.5). The
 * segments joined give back the source unchanged.
 */
export function highlightSnippet(snippet: Snippet): HighlightedSegment[] {
  const segments: HighlightedSegment[] = [];
  const push = (text: string, classes: string) => {
    const last = segments.at(-1);
    if (last?.classes === classes) {
      segments[segments.length - 1] = { text: last.text + text, classes };
    } else {
      segments.push({ text, classes });
    }
  };
  const tree = parsers[snippet.language].parse(snippet.source);
  highlightCode(snippet.source, tree, [classHighlighter, jsxHighlighter], push, () => {
    push("\n", "");
  });
  return segments;
}
