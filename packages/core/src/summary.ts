import {
  type AnsweredQuestion,
  type Level,
  SESSION_LENGTH,
  type TopicId,
} from "@ai-in-learning/shared-types";

import { levelHistory } from "./adaptation.js";
import { type Concept, type ConceptIdOf, findConcept } from "./catalogue.js";

/** What the summary screen shows at the end of a session (AC-7.1, AC-7.2). */
export interface SessionSummary<T extends TopicId = TopicId> {
  /** Correct answers, out of {@link SESSION_LENGTH}. */
  readonly score: number;
  /** The level reached after the last answer. */
  readonly finalLevel: Level;
  /** The level before each question, then the final level: 11 values. */
  readonly levelHistory: readonly Level[];
  /** Concepts whose latest attempt was correct, in order of first appearance. */
  readonly mastered: readonly Concept<ConceptIdOf<T>>[];
  /** Concepts whose latest attempt was incorrect, in order of first appearance. */
  readonly toReview: readonly Concept<ConceptIdOf<T>>[];
}

/**
 * The summary of a complete session, computed from the answers alone (plan §6.5).
 * No model call (NFR-3).
 *
 * A concept seen several times counts only by its latest attempt, so a missed concept
 * answered correctly on a revisit is mastered.
 *
 * Throws a `RangeError` when the session is not complete, and an `Error` when a
 * concept does not belong to `topic` (a `SessionState` that passed validation has
 * neither).
 */
export function summarize<T extends TopicId>(
  topic: T,
  answers: readonly AnsweredQuestion[],
): SessionSummary<T> {
  if (answers.length !== SESSION_LENGTH) {
    throw new RangeError(
      `A summary needs ${String(SESSION_LENGTH)} answers, got ${String(answers.length)}`,
    );
  }

  const latestByConcept = new Map<string, boolean>();
  for (const { conceptId, correct } of answers) {
    latestByConcept.set(conceptId, correct);
  }

  const mastered: Concept<ConceptIdOf<T>>[] = [];
  const toReview: Concept<ConceptIdOf<T>>[] = [];
  for (const [conceptId, correct] of latestByConcept) {
    const concept = findConcept(topic, conceptId);
    if (concept === undefined) {
      throw new Error(`Concept "${conceptId}" does not belong to topic "${topic}"`);
    }
    (correct ? mastered : toReview).push(concept);
  }

  const history = levelHistory(answers);
  const finalLevel = history.at(-1);
  if (finalLevel === undefined) {
    throw new Error("The level history is never empty");
  }

  return {
    score: answers.filter((answer) => answer.correct).length,
    finalLevel,
    levelHistory: history,
    mastered,
    toReview,
  };
}
