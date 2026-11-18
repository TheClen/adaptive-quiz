import { type QuestionKind, SESSION_LENGTH } from "@ai-in-learning/shared-types";

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
