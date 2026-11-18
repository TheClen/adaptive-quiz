import type { AnsweredQuestion, Level } from "@ai-in-learning/shared-types";

/** The level of the first question of every session (AC-4.1). */
export const START_LEVEL = 3 satisfies Level;

/** The easiest level (AC-4.3). */
export const MIN_LEVEL = 1 satisfies Level;

/** The hardest level (AC-4.2). */
export const MAX_LEVEL = 5 satisfies Level;

/** How the level moved after the latest answer. */
export type LevelChange = "up" | "down" | "none";

/**
 * The level before each answered question, followed by the current level (plan §6.1).
 *
 * The result has `answers.length + 1` values: 11 for a complete session. It starts at
 * 3; a correct answer adds 1 (at most 5), an incorrect one subtracts 1 (at least 1).
 * Only the correctness flags count, so the same answers always give the same levels,
 * whatever the model generated (AC-4.5).
 */
export function levelHistory(answers: readonly Pick<AnsweredQuestion, "correct">[]): Level[] {
  const history: Level[] = [START_LEVEL];
  let level: Level = START_LEVEL;
  for (const { correct } of answers) {
    level = correct ? Math.min(level + 1, MAX_LEVEL) : Math.max(level - 1, MIN_LEVEL);
    history.push(level);
  }
  return history;
}

/**
 * Whether the latest answer moved the level up, down or not at all, for the
 * "Level up: 4/5" notice (AC-4.4). `none` before the first answer and at a bound.
 */
export function levelChange(answers: readonly Pick<AnsweredQuestion, "correct">[]): LevelChange {
  const history = levelHistory(answers);
  const previous = history.at(-2);
  const current = history.at(-1);
  if (previous === undefined || current === undefined || previous === current) {
    return "none";
  }
  return current > previous ? "up" : "down";
}
