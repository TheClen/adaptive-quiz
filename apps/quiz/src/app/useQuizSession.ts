import type { SessionState, TopicId } from "@ai-in-learning/shared-types";
import { useEffect, useReducer, useRef } from "react";

import { toRequestFailure } from "../api/client.js";
import { useApiClient } from "./ApiClientContext.js";
import {
  createSeed,
  initialQuizState,
  newSession,
  quizReducer,
  type QuizState,
} from "./sessionReducer.js";

export interface QuizSession {
  readonly state: QuizState;
  /** Starts a new session on `topic` and requests its first question. */
  readonly start: (topic: TopicId) => void;
  /** Resends the failed step with the same session (AC-8.1). */
  readonly retry: () => void;
  /** Leaves the session and shows the home screen. */
  readonly goHome: () => void;
}

/**
 * The quiz session: the reducer plus the requests it needs.
 *
 * Requests are sent from the event handlers, not from an effect, so each action
 * sends exactly one request. The screen switches to its loading state in the
 * render that follows the click (NFR-1).
 */
export function useQuizSession(initialState: QuizState = initialQuizState): QuizSession {
  const api = useApiClient();
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const lastRequestId = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

  function requestQuestion(session: SessionState, requestId: number): void {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    api.nextQuestion({ state: session }, { signal: controller.signal }).then(
      (question) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "questionLoaded", requestId, question });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "requestFailed", requestId, failure: toRequestFailure(error) });
        }
      },
    );
  }

  return {
    state,
    start(topic) {
      const session = newSession(topic, createSeed());
      const requestId = ++lastRequestId.current;
      dispatch({ type: "start", session, requestId });
      requestQuestion(session, requestId);
    },
    retry() {
      if (state.screen !== "error") {
        return;
      }
      const requestId = ++lastRequestId.current;
      dispatch({ type: "retry", requestId });
      requestQuestion(state.session, requestId);
    },
    goHome() {
      inFlight.current?.abort();
      inFlight.current = null;
      dispatch({ type: "goHome" });
    },
  };
}
