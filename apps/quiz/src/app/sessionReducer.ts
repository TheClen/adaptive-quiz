import {
  evaluateChoice,
  levelHistory,
  nextPosition,
  questionStem,
  START_LEVEL,
} from "@ai-in-learning/core";
import {
  type Level,
  type MultipleChoiceQuestion,
  type NextQuestionResponse,
  type OptionId,
  type Position,
  SESSION_LENGTH,
  type SessionState,
  type SingleChoiceQuestion,
  type TopicId,
} from "@ai-in-learning/shared-types";

import type { RequestFailure } from "../api/client.js";

/**
 * The step a failed request belonged to, kept so that Retry resends it with the
 * same session (AC-8.1).
 */
export type FailedStep = "nextQuestion";

/** A question the visitor answers by selecting options. */
export type ChoiceQuestion = SingleChoiceQuestion | MultipleChoiceQuestion;

/**
 * The next question, requested as soon as an answer is evaluated so that it is
 * usually ready when the visitor clicks "Next question" (plan §12, NFR-1). It is
 * the only request for that question (NFR-3).
 */
export type NextQuestion =
  /** The session is complete: "Next question" leads to the summary, which needs no request. */
  | { readonly status: "none" }
  | { readonly status: "pending"; readonly requestId: number }
  | { readonly status: "ready"; readonly question: NextQuestionResponse }
  | { readonly status: "failed"; readonly failure: RequestFailure };

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
      readonly screen: "feedback";
      /** The session with the answer just evaluated as its last one. */
      readonly session: SessionState;
      /** The question just answered. */
      readonly question: NextQuestionResponse & { readonly question: ChoiceQuestion };
      /** The options the visitor selected, in display order. */
      readonly selectedIds: readonly OptionId[];
      readonly next: NextQuestion;
    }
  | {
      readonly screen: "error";
      readonly session: SessionState;
      readonly failure: RequestFailure;
      readonly failedStep: FailedStep;
    }
  | {
      readonly screen: "summary";
      /** The complete session: the summary is computed from its answers, with no request (NFR-3). */
      readonly session: SessionState;
    };

export type QuizAction =
  | { readonly type: "start"; readonly session: SessionState; readonly requestId: number }
  | {
      readonly type: "questionLoaded";
      readonly requestId: number;
      readonly question: NextQuestionResponse;
    }
  | { readonly type: "requestFailed"; readonly requestId: number; readonly failure: RequestFailure }
  | {
      readonly type: "answered";
      /** The session with the answer appended, from {@link withChoiceAnswer}. */
      readonly session: SessionState;
      readonly selectedIds: readonly OptionId[];
      /** The prefetch of the next question, or `null` once the session is complete. */
      readonly requestId: number | null;
    }
  | { readonly type: "next" }
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

/** True when the session has all its answers, so no question follows. */
export function isComplete(session: SessionState): boolean {
  return session.answers.length >= SESSION_LENGTH;
}

/**
 * The session after a choice answer: the answer is evaluated with `core`
 * (AC-2.4) and appended with the question's stem (plan §5).
 */
export function withChoiceAnswer(
  session: SessionState,
  question: NextQuestionResponse & { readonly question: ChoiceQuestion },
  selectedIds: readonly OptionId[],
): SessionState {
  return {
    ...session,
    answers: [
      ...session.answers,
      {
        kind: question.question.kind,
        conceptId: question.conceptId,
        correct: evaluateChoice(question.question, selectedIds),
        stem: questionStem(question.question),
      },
    ],
  };
}

/** True when `question` is answered by selecting options. */
export function isChoiceQuestion(
  question: NextQuestionResponse,
): question is NextQuestionResponse & { readonly question: ChoiceQuestion } {
  return question.question.kind !== "code";
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
      if (isPrefetching(state, action.requestId)) {
        return { ...state, next: { status: "ready", question: action.question } };
      }
      if (state.screen !== "loadingQuestion" || state.requestId !== action.requestId) {
        return state;
      }
      return { screen: "answering", session: state.session, question: action.question };

    case "requestFailed":
      // A failed prefetch waits for "Next question" to be shown (AC-8.1).
      if (isPrefetching(state, action.requestId)) {
        return { ...state, next: { status: "failed", failure: action.failure } };
      }
      if (state.screen !== "loadingQuestion" || state.requestId !== action.requestId) {
        return state;
      }
      return {
        screen: "error",
        session: state.session,
        failure: action.failure,
        failedStep: "nextQuestion",
      };

    case "answered":
      if (state.screen !== "answering" || !isChoiceQuestion(state.question)) {
        return state;
      }
      return {
        screen: "feedback",
        session: action.session,
        question: state.question,
        selectedIds: action.selectedIds,
        next:
          action.requestId === null
            ? { status: "none" }
            : { status: "pending", requestId: action.requestId },
      };

    case "next":
      if (state.screen !== "feedback") {
        return state;
      }
      return showNext(state);

    case "retry":
      if (state.screen !== "error") {
        return state;
      }
      return { screen: "loadingQuestion", session: state.session, requestId: action.requestId };

    case "goHome":
      return initialQuizState;
  }
}

/**
 * "Next question" (AC-6.4): the prefetched question at once, the loading state
 * while the prefetch is on its way, or the error it ended with.
 */
function showNext(state: Extract<QuizState, { readonly screen: "feedback" }>): QuizState {
  switch (state.next.status) {
    case "ready":
      return { screen: "answering", session: state.session, question: state.next.question };
    case "pending":
      // The prefetch carries on: its response lands on the loading screen.
      return { screen: "loadingQuestion", session: state.session, requestId: state.next.requestId };
    case "failed":
      return {
        screen: "error",
        session: state.session,
        failure: state.next.failure,
        failedStep: "nextQuestion",
      };
    case "none":
      // The session is complete: the summary is computed locally (NFR-3).
      return { screen: "summary", session: state.session };
  }
}

/** True when `state` is the feedback screen waiting for the prefetch `requestId`. */
function isPrefetching(
  state: QuizState,
  requestId: number,
): state is Extract<QuizState, { readonly screen: "feedback" }> {
  return (
    state.screen === "feedback" &&
    state.next.status === "pending" &&
    state.next.requestId === requestId
  );
}

/** What the session header shows (AC-1.3). */
export interface SessionProgress {
  readonly topic: TopicId;
  readonly position: Position;
  readonly level: Level;
}

/**
 * The header content of a screen, or `null` on the home and summary screens,
 * which are outside the questions. The position is
 * the question being prepared, answered or retried, or the one just answered on
 * the feedback screen; the level is derived from the answers with `core`, as the
 * API derives it (AC-4.5), so feedback shows the level the answer led to.
 */
export function sessionProgress(state: QuizState): SessionProgress | null {
  if (state.screen === "home" || state.screen === "summary") {
    return null;
  }
  const { topic, answers } = state.session;
  return {
    topic,
    position:
      state.screen === "answering" || state.screen === "feedback"
        ? state.question.position
        : nextPosition(answers),
    level: levelHistory(answers).at(-1) ?? START_LEVEL,
  };
}
