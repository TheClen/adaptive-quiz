import { type RefObject, useEffect, useRef } from "react";

import { LoadingState } from "../components/LoadingState.js";
import { SessionHeader } from "../components/SessionHeader.js";
import { ErrorState } from "../screens/ErrorState.js";
import { Home } from "../screens/Home.js";
import { Question } from "../screens/Question.js";
import { initialQuizState, type QuizState, sessionProgress } from "./sessionReducer.js";
import { useQuizSession } from "./useQuizSession.js";

/** States the quiz can open on. A loading state would never send its request. */
export type InitialQuizState = Exclude<QuizState, { readonly screen: "loadingQuestion" }>;

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
  const { state, start, retry, goHome } = useQuizSession(initialState);
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
        return <Question question={state.question} />;
      case "error":
        return <ErrorState failure={state.failure} onRetry={retry} onHome={goHome} />;
    }
  }
}

/** Changes whenever a new screen appears. */
function screenKey(state: QuizState): string {
  return state.screen === "answering"
    ? `answering:${String(state.question.position)}`
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
