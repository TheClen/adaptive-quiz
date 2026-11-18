import type { TopicId } from "@ai-in-learning/shared-types";

import { type Concept, type ConceptIdOf, conceptsOf } from "./catalogue.js";
import { mulberry32 } from "./random.js";
import { kindAt, nextPosition } from "./schedule.js";

/** The most times one concept may appear in a session (plan §6.4). */
export const MAX_APPEARANCES = 3;

/** The concept of the next question, and whether it comes back after a miss. */
export interface NextConcept<T extends TopicId = TopicId> {
  readonly concept: Concept<ConceptIdOf<T>>;
  /**
   * True when the concept was missed earlier in the session. The prompt then lists the
   * earlier stems on it and asks for a different angle (plan §6.4, §8.3).
   */
  readonly revisit: boolean;
}

/** How often a concept appeared, and the index and outcome of its latest attempt. */
interface History {
  readonly appearances: number;
  readonly latestIndex: number;
  readonly latestCorrect: boolean;
}

/**
 * The concept of the next question (plan §6.4, AC-5.2).
 *
 * 1. **Pending revisits first.** A concept is pending when its latest attempt was
 *    incorrect and it appeared fewer than {@link MAX_APPEARANCES} times. Pending
 *    concepts compatible with the next kind are served first, oldest miss first. Any
 *    concept suits a single- or multiple-choice question; only `exercise` concepts
 *    suit a code exercise, so a missed non-exercise concept waits for the next choice
 *    question.
 * 2. **Otherwise a new concept**, drawn among the compatible concepts not used yet with
 *    mulberry32 seeded by `seed + position`. When none is left, the draw is among the
 *    least-used compatible concepts.
 *
 * The result depends only on `(topic, seed, answers)`, so the client and the server
 * always agree. Answers on concepts of another topic are ignored: validate the state
 * with `checkSessionState` first.
 *
 * Throws a `RangeError` when the session is already complete.
 */
export function selectNextConcept<T extends TopicId>(
  topic: T,
  seed: number,
  answers: readonly { readonly conceptId: string; readonly correct: boolean }[],
): NextConcept<T> {
  const position = nextPosition(answers);
  const kind = kindAt(position);
  const compatible = conceptsOf(topic).filter((concept) => kind !== "code" || concept.exercise);

  const histories = new Map<string, History>();
  answers.forEach(({ conceptId, correct }, index) => {
    histories.set(conceptId, {
      appearances: (histories.get(conceptId)?.appearances ?? 0) + 1,
      latestIndex: index,
      latestCorrect: correct,
    });
  });

  const pending = compatible
    .flatMap((concept) => {
      const history = histories.get(concept.id);
      return history !== undefined &&
        !history.latestCorrect &&
        history.appearances < MAX_APPEARANCES
        ? [{ concept, latestIndex: history.latestIndex }]
        : [];
    })
    .sort((a, b) => a.latestIndex - b.latestIndex);
  const oldestMiss = pending[0];
  if (oldestMiss !== undefined) {
    return { concept: oldestMiss.concept, revisit: true };
  }

  const appearancesOf = (concept: Concept) => histories.get(concept.id)?.appearances ?? 0;
  const fewest = Math.min(...compatible.map(appearancesOf));
  const candidates = compatible.filter((concept) => appearancesOf(concept) === fewest);
  const concept = candidates[Math.floor(mulberry32(seed + position)() * candidates.length)];
  if (concept === undefined) {
    throw new Error(`Topic "${topic}" has no concept for a ${kind} question`);
  }
  return { concept, revisit: false };
}
