import {
  type MultipleChoiceQuestion,
  OptionId,
  type SingleChoiceQuestion,
} from "@ai-in-learning/shared-types";

import { mulberry32 } from "../../random.js";
import type { ChoiceKind } from "./choice-rules.js";
import type { ChoiceDraft } from "./drafts.js";

/**
 * Mixed into the session seed for the option shuffle, so the shuffle does not reuse
 * the numbers of the concept draw, which is seeded by `seed + position` (plan §6.4).
 */
const SHUFFLE_SALT = 0x5f3759df;

/**
 * The generator of the option shuffle at `position`: the session PRNG (mulberry32),
 * seeded from the session seed and the position (plan §8.4 step 4).
 */
export function shuffleRandom(seed: number, position: number): () => number {
  return mulberry32(((seed ^ SHUFFLE_SALT) >>> 0) + position);
}

/** A Fisher-Yates shuffle of a copy of `items`. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const swapped = shuffled[other];
    if (current !== undefined && swapped !== undefined) {
      shuffled[index] = swapped;
      shuffled[other] = current;
    }
  }
  return shuffled;
}

/**
 * Turns a draft that passed the domain rules into a question (plan §8.4 step 4):
 * shuffles the options, since the model tends to put the correct answer in a fixed
 * position, then assigns ids `a` to `f` in display order. Rationales are dropped.
 *
 * Throws a `RangeError` when the draft has more options than there are ids; the
 * domain rules reject such a draft first.
 */
export function toChoiceQuestion(
  kind: ChoiceKind,
  draft: ChoiceDraft,
  random: () => number,
): SingleChoiceQuestion | MultipleChoiceQuestion {
  const options = shuffle(draft.options, random).map((option, index) => {
    const id = OptionId.options[index];
    if (id === undefined) {
      throw new RangeError(`A draft has at most ${String(OptionId.options.length)} options`);
    }
    return { id, text: option.text, correct: option.correct };
  });
  const correctIds = options.filter((option) => option.correct).map((option) => option.id);
  const shared = {
    prompt: draft.prompt,
    snippet: draft.snippet,
    options: options.map(({ id, text }) => ({ id, text })),
    explanation: draft.explanation,
  };

  if (kind === "multiple") {
    return { kind, ...shared, correctOptionIds: correctIds };
  }
  const [correctOptionId] = correctIds;
  if (correctOptionId === undefined || correctIds.length !== 1) {
    throw new RangeError("A single-choice draft has exactly one correct option");
  }
  return { kind, ...shared, correctOptionId };
}
