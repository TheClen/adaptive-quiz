import { levelChange, levelHistory, START_LEVEL } from "@ai-in-learning/core";
import { type RefObject, useEffect, useRef } from "react";

import { LoadingState } from "../components/LoadingState.js";
import { SessionHeader } from "../components/SessionHeader.js";
import { ErrorState } from "../screens/ErrorState.js";
import { Feedback } from "../screens/Feedback.js";
import { Home } from "../screens/Home.js";
import { Question } from "../screens/Question.js";
import {
  initialQuizState,
  type NextQuestion,
  type QuizState,
  sessionProgress,
} from "./sessionReducer.js";
import { useQuizSession } from "./useQuizSession.js";

type FeedbackState = Extract<QuizState, { readonly screen: "feedback" }>;

/**
 * States the quiz can open on. A loading state, or a feedback screen waiting for
 * its prefetch, would never send its request.
 */
export type InitialQuizState =
  | Exclude<QuizState, { readonly screen: "loadingQuestion" } | FeedbackState>
  | (FeedbackState & {
      readonly next: Exclude<NextQuestion, { readonly status: "pending" }>;
    });

/**
 * The quiz: one page, no router. The session reducer decides the screen
 * (plan §13.1).
 */
export function QuizApp({
  initialState = initialQuizState,
}: {
  /** The state to open on. The app opens on the home screen; tests open on others. */
  readonly initialState?: InitialQuizState;
}) {
  const { state, start, submitAnswer, next, retry, goHome } = useQuizSession(initialState);
  const progress = sessionProgress(state);
  const main = useRef<HTMLElement>(null);
  useFocusOnScreenChange(main, screenKey(state));

  return (
    <>
      {progress === null ? null : <SessionHeader progress={progress} />}
      <main ref={main}>{renderScreen()}</main>
    </>
  );

  function renderScreen() {
    switch (state.screen) {
      case "home":
        return <Home onStart={start} />;
      case "loadingQuestion":
        return <LoadingState message="Preparing your question…" />;
      case "answering":
        return (
          <Question
            key={state.question.position}
            question={state.question}
            onSubmit={submitAnswer}
          />
        );
      case "feedback": {
        const { answers } = state.session;
        return (
          <Feedback
            question={state.question}
            selectedIds={state.selectedIds}
            correct={answers.at(-1)?.correct ?? false}
            levelChange={levelChange(answers)}
            level={levelHistory(answers).at(-1) ?? START_LEVEL}
            // The summary after the last question arrives with T22.
            onNext={state.next.status === "none" ? null : next}
          />
        );
      }
      case "error":
        return <ErrorState failure={state.failure} onRetry={retry} onHome={goHome} />;
    }
  }
}

/** Changes whenever a new screen appears. */
function screenKey(state: QuizState): string {
  return state.screen === "answering" || state.screen === "feedback"
    ? `${state.screen}:${String(state.question.position)}`
    : state.screen;
}

/**
 * Moves focus to the heading of each new screen, so keyboard and screen reader
 * users start from its top (plan §13.3). The first screen keeps the browser's
 * default focus.
 */
function useFocusOnScreenChange(main: RefObject<HTMLElement | null>, key: string): void {
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) {
      return;
    }
    previousKey.current = key;
    main.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [main, key]);
}
