import { describe, expect, it } from "vitest";

import {
  codeQuestion,
  completeSession,
  failingResults,
  firstQuestion,
  lastQuestion,
  multipleChoiceQuestion,
  negativeReview,
  passingResults,
  secondQuestion,
  sessionWithNineAnswers,
  sessionWithThreeAnswers,
} from "../testing/fixtures.js";
import {
  codeReviewRequest,
  createSeed,
  initialQuizState,
  isComplete,
  newSession,
  quizReducer,
  type QuizState,
  sessionProgress,
  withChoiceAnswer,
  withCodeAnswer,
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

describe("withChoiceAnswer", () => {
  it("appends the evaluated answer with the stem of the question (plan §5)", () => {
    expect(withChoiceAnswer(session, firstQuestion, ["b"]).answers).toEqual([
      {
        kind: "single",
        conceptId: "closures",
        correct: true,
        stem: firstQuestion.question.prompt,
      },
    ]);
  });

  it("records a partial multiple-choice selection as incorrect (AC-2.4)", () => {
    const answered = withChoiceAnswer(sessionWithThreeAnswers, multipleChoiceQuestion, ["a"]);
    expect(answered.answers).toHaveLength(4);
    expect(answered.answers.at(-1)).toMatchObject({ kind: "multiple", correct: false });
    expect(answered).toMatchObject({ topic: "javascript", seed: 42 });
  });

  it("leaves the session it was given unchanged", () => {
    withChoiceAnswer(session, firstQuestion, ["b"]);
    expect(session.answers).toEqual([]);
  });
});

describe("isComplete", () => {
  it("is true from the 10th answer", () => {
    expect(isComplete(sessionWithNineAnswers)).toBe(false);
    expect(isComplete(withChoiceAnswer(sessionWithNineAnswers, lastQuestion, ["b"]))).toBe(true);
  });
});

describe("quizReducer feedback and prefetch", () => {
  const answering: QuizState = { screen: "answering", session, question: firstQuestion };
  const answered = withChoiceAnswer(session, firstQuestion, ["b"]);
  const feedback = quizReducer(answering, {
    type: "answered",
    session: answered,
    selectedIds: ["b"],
    requestId: 2,
  });

  it("shows the feedback while the next question is prefetched (plan §12)", () => {
    expect(feedback).toEqual({
      screen: "feedback",
      session: answered,
      question: firstQuestion,
      selectedIds: ["b"],
      next: { status: "pending", requestId: 2 },
    });
  });

  it("prefetches nothing after the last answer", () => {
    expect(
      quizReducer(answering, {
        type: "answered",
        session: answered,
        selectedIds: ["b"],
        requestId: null,
      }),
    ).toMatchObject({ screen: "feedback", next: { status: "none" } });
  });

  it("ignores an answer outside the question screen", () => {
    expect(
      quizReducer(loading, { type: "answered", session: answered, selectedIds: [], requestId: 2 }),
    ).toBe(loading);
  });

  it("keeps the prefetched question until Next question", () => {
    const ready = quizReducer(feedback, {
      type: "questionLoaded",
      requestId: 2,
      question: secondQuestion,
    });

    expect(ready).toMatchObject({
      screen: "feedback",
      next: { status: "ready", question: secondQuestion },
    });
    expect(quizReducer(ready, { type: "next" })).toEqual({
      screen: "answering",
      session: answered,
      question: secondQuestion,
    });
  });

  it("shows the loading state on Next question while the prefetch is pending", () => {
    const waiting = quizReducer(feedback, { type: "next" });

    expect(waiting).toEqual({ screen: "loadingQuestion", session: answered, requestId: 2 });
    expect(
      quizReducer(waiting, { type: "questionLoaded", requestId: 2, question: secondQuestion }),
    ).toEqual({ screen: "answering", session: answered, question: secondQuestion });
  });

  it("keeps a prefetch failure until Next question, then shows the error", () => {
    const failure = { code: "ai_unavailable" } as const;
    const failed = quizReducer(feedback, { type: "requestFailed", requestId: 2, failure });

    expect(failed).toMatchObject({ screen: "feedback", next: { status: "failed", failure } });
    expect(quizReducer(failed, { type: "next" })).toEqual({
      screen: "error",
      session: answered,
      failure,
      failedStep: "nextQuestion",
    });
  });

  it("ignores a response to another request", () => {
    expect(
      quizReducer(feedback, { type: "questionLoaded", requestId: 1, question: secondQuestion }),
    ).toBe(feedback);
    expect(
      quizReducer(feedback, {
        type: "requestFailed",
        requestId: 1,
        failure: { code: "internal" },
      }),
    ).toBe(feedback);
  });

  it("shows the summary after the last feedback, with no request (NFR-3)", () => {
    const last = quizReducer(answering, {
      type: "answered",
      session: answered,
      selectedIds: ["b"],
      requestId: null,
    });
    expect(quizReducer(last, { type: "next" })).toEqual({ screen: "summary", session: answered });
  });

  it("ignores Next question outside the feedback screen", () => {
    expect(quizReducer(answering, { type: "next" })).toBe(answering);
  });
});

describe("sessionProgress", () => {
  it("is null on the home screen", () => {
    expect(sessionProgress(initialQuizState)).toBeNull();
  });

  it("is null on the summary screen", () => {
    expect(sessionProgress({ screen: "summary", session: completeSession })).toBeNull();
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

  it("gives the answered position and the level it led to on the feedback screen", () => {
    expect(
      sessionProgress({
        screen: "feedback",
        session: withChoiceAnswer(session, firstQuestion, ["b"]),
        question: firstQuestion,
        selectedIds: ["b"],
        next: { status: "pending", requestId: 2 },
      }),
    ).toEqual({ topic: "javascript", position: 1, level: 4 });
  });
});

describe("withCodeAnswer", () => {
  it("records a code answer as correct only when every test passed (AC-3.3)", () => {
    const answer = {
      kind: "code",
      conceptId: "array-methods",
      stem: codeQuestion.question.prompt,
    };
    expect(
      withCodeAnswer(sessionWithThreeAnswers, codeQuestion, passingResults).answers.at(-1),
    ).toEqual({ ...answer, correct: true });
    expect(
      withCodeAnswer(sessionWithThreeAnswers, codeQuestion, failingResults).answers.at(-1),
    ).toEqual({ ...answer, correct: false });
    expect(withCodeAnswer(sessionWithThreeAnswers, codeQuestion, []).answers.at(-1)?.correct).toBe(
      false,
    );
  });
});

describe("codeReviewRequest", () => {
  it("sends the signed exercise, the level it was asked at and the code (plan §7.2)", () => {
    expect(codeReviewRequest(sessionWithThreeAnswers, codeQuestion, "code")).toEqual({
      topic: "javascript",
      conceptId: "array-methods",
      level: 4,
      exercise: codeQuestion.question,
      code: "code",
    });
  });
});

describe("quizReducer with a code exercise", () => {
  const answering: QuizState = {
    screen: "answering",
    session: sessionWithThreeAnswers,
    question: codeQuestion,
  };
  const answered = withCodeAnswer(sessionWithThreeAnswers, codeQuestion, passingResults);
  const feedback = quizReducer(answering, {
    type: "codeAnswered",
    session: answered,
    code: "code",
    testResults: passingResults,
    requestId: 5,
    reviewRequestId: 6,
  });

  it("shows the code feedback with the review and the prefetch pending", () => {
    expect(feedback).toEqual({
      screen: "codeFeedback",
      session: answered,
      question: codeQuestion,
      code: "code",
      testResults: passingResults,
      review: { status: "pending", requestId: 6 },
      next: { status: "pending", requestId: 5 },
    });
    expect(sessionProgress(feedback)).toEqual({ topic: "javascript", position: 4, level: 5 });
  });

  it("ignores a code answer on a choice question, and a choice answer on an exercise", () => {
    const choice: QuizState = { ...answering, question: firstQuestion };
    expect(
      quizReducer(choice, {
        type: "codeAnswered",
        session: answered,
        code: "code",
        testResults: passingResults,
        requestId: 5,
        reviewRequestId: 6,
      }),
    ).toBe(choice);
    expect(
      quizReducer(answering, { type: "answered", session, selectedIds: ["a"], requestId: 5 }),
    ).toBe(answering);
  });

  it("shows the review that answers the pending request, and ignores older ones", () => {
    const loaded = quizReducer(feedback, {
      type: "reviewLoaded",
      requestId: 6,
      review: negativeReview.review,
    });
    expect(loaded).toMatchObject({ review: { status: "ready", review: negativeReview.review } });
    expect(
      quizReducer(feedback, { type: "reviewLoaded", requestId: 4, review: negativeReview.review }),
    ).toBe(feedback);
    expect(quizReducer(feedback, { type: "reviewFailed", requestId: 4 })).toBe(feedback);
  });

  it("retries a review only after it failed", () => {
    const failed = quizReducer(feedback, { type: "reviewFailed", requestId: 6 });
    expect(failed).toMatchObject({ review: { status: "failed" } });

    expect(quizReducer(failed, { type: "retryReview", requestId: 7 })).toMatchObject({
      review: { status: "pending", requestId: 7 },
    });
    expect(quizReducer(feedback, { type: "retryReview", requestId: 7 })).toBe(feedback);
  });

  it("keeps the prefetch and the review apart", () => {
    const prefetched = quizReducer(feedback, {
      type: "questionLoaded",
      requestId: 5,
      question: secondQuestion,
    });
    expect(prefetched).toMatchObject({
      review: { status: "pending", requestId: 6 },
      next: { status: "ready", question: secondQuestion },
    });
    expect(quizReducer(prefetched, { type: "next" })).toEqual({
      screen: "answering",
      session: answered,
      question: secondQuestion,
    });
  });

  it("drops a review that arrives after leaving the feedback", () => {
    const next = quizReducer(feedback, { type: "next" });
    expect(
      quizReducer(next, { type: "reviewLoaded", requestId: 6, review: negativeReview.review }),
    ).toBe(next);
  });
});
