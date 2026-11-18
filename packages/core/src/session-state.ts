import {
  isConceptOfTopic,
  type Position,
  type QuestionKind,
  SESSION_LENGTH,
  type SessionState,
} from "@ai-in-learning/shared-types";

import { KIND_SCHEDULE } from "./schedule.js";

/** A reason why the API cannot generate a question for a session state. */
export type SessionStateIssue =
  | { readonly code: "session_complete"; readonly answers: number }
  | {
      readonly code: "kind_mismatch";
      readonly position: Position;
      readonly expected: QuestionKind;
      readonly actual: QuestionKind;
    }
  | {
      readonly code: "concept_not_in_topic";
      readonly position: Position;
      readonly conceptId: string;
    };

/** The outcome of {@link checkSessionState}. */
export type SessionStateCheck =
  { readonly ok: true } | { readonly ok: false; readonly issues: readonly SessionStateIssue[] };

/**
 * Checks that a session state is consistent and can receive another question
 * (plan §5): every answer has the kind the schedule gives its position, every concept
 * belongs to the topic, and the session is not complete. The API rejects a state with
 * issues as `invalid_request`.
 *
 * Every issue is reported, in order of position, with the complete session first.
 */
export function checkSessionState(
  state: Pick<SessionState, "topic" | "answers">,
): SessionStateCheck {
  const issues: SessionStateIssue[] = [];
  if (state.answers.length >= SESSION_LENGTH) {
    issues.push({ code: "session_complete", answers: state.answers.length });
  }

  state.answers.forEach((answer, index) => {
    const position = index + 1;
    const expected = KIND_SCHEDULE[index];
    if (expected !== undefined && answer.kind !== expected) {
      issues.push({ code: "kind_mismatch", position, expected, actual: answer.kind });
    }
    if (!isConceptOfTopic(state.topic, answer.conceptId)) {
      issues.push({ code: "concept_not_in_topic", position, conceptId: answer.conceptId });
    }
  });

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
