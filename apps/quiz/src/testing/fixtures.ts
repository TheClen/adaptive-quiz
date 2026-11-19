/**
 * Fixtures for the quiz tests. Not imported by the app, so never bundled.
 */
import type { NextQuestionResponse, SessionState } from "@ai-in-learning/shared-types";

/** The first question of a JavaScript session. */
export const firstQuestion = {
  position: 1,
  level: 3,
  conceptId: "closures",
  conceptLabel: "Closures",
  question: {
    kind: "single",
    prompt: "What does the counter log after two calls?",
    snippet: null,
    options: [
      { id: "a", text: "1" },
      { id: "b", text: "2" },
      { id: "c", text: "undefined" },
      { id: "d", text: "It throws a ReferenceError" },
    ],
    correctOptionId: "b",
    explanation: "The returned function closes over `count`, which keeps its value between calls.",
  },
} satisfies NextQuestionResponse;

/** A JavaScript session after three answers: right, right, wrong, so at level 4. */
export const sessionWithThreeAnswers = {
  version: 1,
  topic: "javascript",
  seed: 42,
  answers: [
    { kind: "single", conceptId: "closures", correct: true, stem: "What does this closure log?" },
    {
      kind: "multiple",
      conceptId: "array-methods",
      correct: true,
      stem: "Which methods return a new array?",
    },
    { kind: "single", conceptId: "promises", correct: false, stem: "In what order do these log?" },
  ],
} satisfies SessionState;
