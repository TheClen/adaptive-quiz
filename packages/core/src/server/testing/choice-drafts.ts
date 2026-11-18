import type { SessionState } from "@ai-in-learning/shared-types";

import type { ChoiceDraft } from "../generation/drafts.js";

/** A valid single-choice draft for the JavaScript topic. The correct option is first. */
export const validSingleDraft = {
  prompt: "What does this snippet log?",
  snippet: {
    language: "javascript",
    source: "const counter = makeCounter();\ncounter();\nconsole.log(counter());",
  },
  options: [
    { text: "2", rationale: "Each call increments the captured variable.", correct: true },
    { text: "1", rationale: "This ignores the first call.", correct: false },
    { text: "undefined", rationale: "The function returns the count.", correct: false },
    { text: "It throws a ReferenceError", rationale: "The variable is in scope.", correct: false },
  ],
  explanation:
    "The returned function closes over `count`, so each call sees the value left by the previous one.",
} satisfies ChoiceDraft;

/** A valid multiple-choice draft for the JavaScript topic, 2 correct options out of 4. */
export const validMultipleDraft = {
  prompt: "Which statements about closures in JavaScript are true?",
  snippet: null,
  options: [
    {
      text: "A closure keeps access to variables of its outer scope",
      rationale: "That is the definition of a closure.",
      correct: true,
    },
    {
      text: "Closures capture variables, not copies of their values",
      rationale: "Later changes to the variable are visible.",
      correct: true,
    },
    {
      text: "Closures only exist for arrow functions",
      rationale: "Every function forms a closure.",
      correct: false,
    },
    {
      text: "A closure is created only when a function is returned",
      rationale: "Any function defined in a scope closes over it.",
      correct: false,
    },
  ],
  explanation:
    "Every function closes over the scope it is defined in and sees the current value of each captured variable.",
} satisfies ChoiceDraft;

/** A JavaScript session state whose next question is single choice (position 1). */
export const singleChoiceState = {
  version: 1,
  topic: "javascript",
  seed: 42,
  answers: [],
} satisfies SessionState;

/** A JavaScript session state whose next question is multiple choice (position 2). */
export const multipleChoiceState = {
  version: 1,
  topic: "javascript",
  seed: 42,
  answers: [
    {
      kind: "single",
      conceptId: "promises",
      correct: true,
      stem: "When does the callback passed to then run?",
    },
  ],
} satisfies SessionState;
