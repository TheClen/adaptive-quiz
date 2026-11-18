/**
 * Helpers that place untrusted text inside the tagged blocks of a prompt (plan §8.3,
 * §10). Text from the client (earlier stems, submitted code) and from earlier model
 * output is data: it must not be able to close a block or open a new one.
 */

/** Every tag the prompts use. Only these are neutralised, so code keeps its `<`. */
export const PROMPT_TAGS = [
  "request",
  "earlier_questions",
  "previous_questions",
  "retry",
  "exercise",
  "verdict",
  "test_results",
  "submission",
  "reference_solution",
] as const;

export type PromptTag = (typeof PROMPT_TAGS)[number];

const TAG_PATTERN = new RegExp(`<(/?)(${PROMPT_TAGS.join("|")})(?=[\\s>/]|$)`, "gi");

/**
 * Replaces the `<` of any prompt tag in `text` with `&lt;`, so the text cannot close
 * the block it is quoted in. Other `<` characters, as in `a < b`, are kept.
 */
export function neutraliseTags(text: string): string {
  return text.replace(TAG_PATTERN, "&lt;$1$2");
}

/** `text` on a single line, whitespace collapsed and tags neutralised. */
export function quoteLine(text: string): string {
  return neutraliseTags(text.replace(/\s+/g, " ").trim());
}

/** `text` as a block of lines, tags neutralised. Line breaks and indentation are kept. */
export function quoteBlock(text: string): string {
  return neutraliseTags(text.replace(/\r\n?/g, "\n").trimEnd());
}

/** A tagged block, with each line of `lines` on its own line between the tags. */
export function block(tag: PromptTag, lines: readonly string[]): string {
  return [`<${tag}>`, ...lines, `</${tag}>`].join("\n");
}

/** A Markdown bullet list, one item per line. */
export function bullets(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

/** A Markdown section of a system prompt: a heading, then its body. */
export function section(title: string, body: string): string {
  return `# ${title}\n\n${body}`;
}
