import { type Position, type QuestionKind, SESSION_LENGTH } from "@ai-in-learning/shared-types";

/**
 * The question kind at each position of a session, positions 1 to 10 at indexes 0
 * to 9 (plan §6.2). Two code exercises, never first and never consecutive.
 */
export const KIND_SCHEDULE = [
  "single",
  "multiple",
  "single",
  "code",
  "single",
  "multiple",
  "single",
  "code",
  "multiple",
  "single",
] as const satisfies readonly QuestionKind[] & { length: typeof SESSION_LENGTH };

/** The kind of the question at `position`, 1 to 10 (plan §6.2). */
export function kindAt(position: Position): QuestionKind {
  const kind = KIND_SCHEDULE[position - 1];
  if (kind === undefined) {
    throw new RangeError(
      `Position must be between 1 and ${String(SESSION_LENGTH)}, got ${String(position)}`,
    );
  }
  return kind;
}

/**
 * The position of the next question, 1 to 10: one more than the number of answers
 * (plan §5).
 *
 * Throws a `RangeError` when the session is already complete.
 */
export function nextPosition(answers: readonly unknown[]): Position {
  if (answers.length >= SESSION_LENGTH) {
    throw new RangeError(
      `The session is complete: ${String(answers.length)} answers out of ${String(SESSION_LENGTH)}`,
    );
  }
  return answers.length + 1;
}

/**
 * The kind of the next question, from the kind schedule (plan §6.2).
 *
 * Throws a `RangeError` when the session is already complete.
 */
export function nextKind(answers: readonly unknown[]): QuestionKind {
  return kindAt(nextPosition(answers));
}
