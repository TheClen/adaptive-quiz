import { STEM_MAX_LENGTH } from "@ai-in-learning/shared-types";

/**
 * The stem the client records for an answered question: its prompt, cut to
 * {@link STEM_MAX_LENGTH} characters (plan §5). The server compares new drafts with
 * stems built the same way (plan §8.4), so the client must use this function.
 *
 * A cut that would split a surrogate pair drops its first half, so the stem stays
 * well-formed text.
 */
export function questionStem(question: { readonly prompt: string }): string {
  const stem = question.prompt.slice(0, STEM_MAX_LENGTH);
  const last = stem.charCodeAt(stem.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? stem.slice(0, -1) : stem;
}
