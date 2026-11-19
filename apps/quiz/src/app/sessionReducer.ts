import { levelHistory, nextPosition, START_LEVEL } from "@ai-in-learning/core";
import type {
  Level,
  NextQuestionResponse,
  Position,
  SessionState,
  TopicId,
} from "@ai-in-learning/shared-types";

import type { RequestFailure } from "../api/client.js";

/**
 * The step a failed request belonged to, kept so that Retry resends it with the
 * same session (AC-8.1).
 */
export type FailedStep = "nextQuestion";

/**
 * What the quiz shows (plan §13.1). Every screen after the home screen holds the
 * session, so a failure never loses progress.
 */
export type QuizState =
  | { readonly screen: "home" }
  | {
      readonly screen: "loadingQuestion";
      readonly session: SessionState;
      /** Identifies the pending request, so a late response to an older one is ignored. */
      readonly requestId: number;
    }
  | {
      readonly screen: "answering";
      readonly session: SessionState;
      readonly question: NextQuestionResponse;
    }
  | {
      readonly screen: "error";
      readonly session: SessionState;
      readonly failure: RequestFailure;
      readonly failedStep: FailedStep;
    };

export type QuizAction =
  | { readonly type: "start"; readonly session: SessionState; readonly requestId: number }
  | {
      readonly type: "questionLoaded";
      readonly requestId: number;
      readonly question: NextQuestionResponse;
    }
  | { readonly type: "requestFailed"; readonly requestId: number; readonly failure: RequestFailure }
  | { readonly type: "retry"; readonly requestId: number }
  | { readonly type: "goHome" };

export const initialQuizState = { screen: "home" } as const satisfies QuizState;

/** A new session on `topic`, with no answers yet (plan §5). */
export function newSession(topic: TopicId, seed: number): SessionState {
  return { version: 1, topic, seed, answers: [] };
}

/** A random uint32 seed for a new session, from the Web Crypto API (plan §5). */
export function createSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/**
 * The session reducer. It is pure: requests are sent by the caller, which gives
 * each one the `requestId` of the action that started it.
 */
export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "start":
      return { screen: "loadingQuestion", session: action.session, requestId: action.requestId };

    case "questionLoaded":
      if (state.screen !== "loadingQuestion" || state.requestId !== action.requestId) {
        return state;
      }
      return { screen: "answering", session: state.session, question: action.question };

    case "requestFailed":
      if (state.screen !== "loadingQuestion" || state.requestId !== action.requestId) {
        return state;
      }
      return {
        screen: "error",
        session: state.session,
        failure: action.failure,
        failedStep: "nextQuestion",
      };

    case "retry":
      if (state.screen !== "error") {
        return state;
      }
      return { screen: "loadingQuestion", session: state.session, requestId: action.requestId };

    case "goHome":
      return initialQuizState;
  }
}

/** What the session header shows (AC-1.3). */
export interface SessionProgress {
  readonly topic: TopicId;
  readonly position: Position;
  readonly level: Level;
}

/**
 * The header content of a screen, or `null` on the home screen. The position is
 * the question being prepared, answered or retried; the level is derived from the
 * answers with `core`, as the API derives it (AC-4.5).
 */
export function sessionProgress(state: QuizState): SessionProgress | null {
  if (state.screen === "home") {
    return null;
  }
  const { topic, answers } = state.session;
  return {
    topic,
    position: state.screen === "answering" ? state.question.position : nextPosition(answers),
    level: levelHistory(answers).at(-1) ?? START_LEVEL,
  };
}
