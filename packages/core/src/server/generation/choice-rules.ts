import { LIMITS, type TopicId } from "@ai-in-learning/shared-types";

import { questionStem } from "../../stem.js";
import type { RetryReason } from "../prompts/index.js";
import type { ChoiceDraft } from "./drafts.js";
import { findNearDuplicate } from "./similarity.js";

/** The choice kinds this pipeline generates. */
export type ChoiceKind = "single" | "multiple";

/** Option counts per kind (AC-2.1, AC-2.2). */
const OPTION_COUNTS = {
  single: { min: 4, max: 4 },
  multiple: { min: 4, max: 6 },
} as const satisfies Record<ChoiceKind, { min: number; max: number }>;

/**
 * Option texts are compared after Unicode normalisation, with whitespace collapsed.
 * Case and punctuation are kept: in code, `==` and `===`, or `null` and `"null"`,
 * are different answers.
 */
function normaliseOption(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function countRule(kind: ChoiceKind, draft: ChoiceDraft): RetryReason | null {
  const { min, max } = OPTION_COUNTS[kind];
  const count = draft.options.length;
  if (count < min || count > max) {
    return { rule: "option-count", count };
  }
  const correct = draft.options.filter((option) => option.correct).length;
  if (kind === "single" ? correct !== 1 : correct < 2) {
    return { rule: "correct-count", count: correct };
  }
  if (correct === count) {
    return { rule: "no-incorrect-option" };
  }
  return null;
}

function lengthRule(draft: ChoiceDraft): RetryReason | null {
  if (draft.prompt.length > LIMITS.prompt) {
    return { rule: "field-too-long", field: "prompt" };
  }
  if (draft.options.some((option) => option.text.length > LIMITS.optionText)) {
    return { rule: "field-too-long", field: "option" };
  }
  if (draft.explanation.length > LIMITS.explanation) {
    return { rule: "field-too-long", field: "explanation" };
  }
  if (draft.snippet !== null && draft.snippet.source.length > LIMITS.code) {
    return { rule: "field-too-long", field: "code" };
  }
  return null;
}

function duplicateOptionRule(draft: ChoiceDraft): RetryReason | null {
  const texts = new Set(draft.options.map((option) => normaliseOption(option.text)));
  return texts.size === draft.options.length ? null : { rule: "duplicate-options" };
}

/** A snippet is `javascript`, or `jsx` in the React topic only (plan §8.4). */
function snippetRule(topic: TopicId, draft: ChoiceDraft): RetryReason | null {
  return draft.snippet?.language === "jsx" && topic !== "react"
    ? { rule: "snippet-language" }
    : null;
}

/**
 * The near-duplicate check (AC-5.3). `previousStems` are the stems of the session in
 * order, as listed in `<previous_questions>`, so the reason gives the 1-based line of
 * the similar one. A session asks for a question with at most 9 answers, so every
 * previous stem is listed.
 */
function nearDuplicateRule(
  draft: ChoiceDraft,
  previousStems: readonly string[],
): RetryReason | null {
  const index = findNearDuplicate(questionStem(draft), previousStems);
  return index === -1 ? null : { rule: "near-duplicate", question: index + 1 };
}

/**
 * The domain rules of a choice draft (plan §8.4 step 2). Returns the first rule the
 * draft breaks, or `null` when it follows every rule.
 */
export function checkChoiceDraft(
  kind: ChoiceKind,
  topic: TopicId,
  draft: ChoiceDraft,
  previousStems: readonly string[],
): RetryReason | null {
  return (
    countRule(kind, draft) ??
    lengthRule(draft) ??
    duplicateOptionRule(draft) ??
    snippetRule(topic, draft) ??
    nearDuplicateRule(draft, previousStems)
  );
}
