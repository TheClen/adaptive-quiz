import { describe, expect, it } from "vitest";

import { firstQuestion, sessionWithThreeAnswers } from "../testing/fixtures.js";
import {
  createSeed,
  initialQuizState,
  newSession,
  quizReducer,
  type QuizState,
  sessionProgress,
} from "./sessionReducer.js";

const session = newSession("javascript", 7);

const loading: QuizState = { screen: "loadingQuestion", session, requestId: 1 };

describe("newSession", () => {
  it("starts with no answers", () => {
    expect(session).toEqual({ version: 1, topic: "javascript", seed: 7, answers: [] });
  });
});

describe("createSeed", () => {
  it("returns a uint32", () => {
    const seed = createSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffff_ffff);
  });
});

describe("quizReducer", () => {
  it("opens on the home screen", () => {
    expect(initialQuizState).toEqual({ screen: "home" });
  });

  it("shows the loading state as soon as a session starts (NFR-1)", () => {
    expect(quizReducer(initialQuizState, { type: "start", session, requestId: 1 })).toEqual(
      loading,
    );
  });

  it("shows the question that answers the pending request", () => {
    expect(
      quizReducer(loading, { type: "questionLoaded", requestId: 1, question: firstQuestion }),
    ).toEqual({ screen: "answering", session, question: firstQuestion });
  });

  it("ignores a response to an older request", () => {
    expect(
      quizReducer(loading, { type: "questionLoaded", requestId: 0, question: firstQuestion }),
    ).toBe(loading);
    expect(
      quizReducer(loading, { type: "requestFailed", requestId: 0, failure: { code: "internal" } }),
    ).toBe(loading);
  });

  it("ignores a response that arrives after leaving the session", () => {
    const home = quizReducer(loading, { type: "goHome" });
    expect(
      quizReducer(home, { type: "questionLoaded", requestId: 1, question: firstQuestion }),
    ).toBe(home);
  });

  it("keeps the session and the failed step on a failure", () => {
    const failure = { code: "rate_limited", retryAfterSeconds: 60 } as const;
    expect(quizReducer(loading, { type: "requestFailed", requestId: 1, failure })).toEqual({
      screen: "error",
      session,
      failure,
      failedStep: "nextQuestion",
    });
  });

  it("retries with the same session, answers included (AC-8.1)", () => {
    const failed: QuizState = {
      screen: "error",
      session: sessionWithThreeAnswers,
      failure: { code: "ai_unavailable" },
      failedStep: "nextQuestion",
    };

    const retried = quizReducer(failed, { type: "retry", requestId: 2 });

    expect(retried).toEqual({
      screen: "loadingQuestion",
      session: sessionWithThreeAnswers,
      requestId: 2,
    });
    expect(retried.screen === "loadingQuestion" && retried.session).toBe(sessionWithThreeAnswers);
  });

  it("does not retry when nothing failed", () => {
    expect(quizReducer(loading, { type: "retry", requestId: 2 })).toBe(loading);
  });

  it("goes back home from any screen", () => {
    expect(quizReducer(loading, { type: "goHome" })).toEqual({ screen: "home" });
  });
});

describe("sessionProgress", () => {
  it("is null on the home screen", () => {
    expect(sessionProgress(initialQuizState)).toBeNull();
  });

  it("gives the next position and the level derived from the answers", () => {
    // 3, then right (4), right (5), wrong (4).
    expect(
      sessionProgress({
        screen: "error",
        session: sessionWithThreeAnswers,
        failure: { code: "internal" },
        failedStep: "nextQuestion",
      }),
    ).toEqual({ topic: "javascript", position: 4, level: 4 });
  });

  it("starts a session at question 1, level 3", () => {
    expect(sessionProgress(loading)).toEqual({ topic: "javascript", position: 1, level: 3 });
  });

  it("gives the position of the question being answered", () => {
    expect(sessionProgress({ screen: "answering", session, question: firstQuestion })).toEqual({
      topic: "javascript",
      position: 1,
      level: 3,
    });
  });
});
