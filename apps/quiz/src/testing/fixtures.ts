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

/** A multiple-choice React question with a JSX snippet. */
export const multipleChoiceQuestion = {
  position: 2,
  level: 3,
  conceptId: "jsx-and-rendering",
  conceptLabel: "JSX and rendering",
  question: {
    kind: "multiple",
    prompt: "Which values are good keys for these list items?",
    snippet: {
      language: "jsx",
      source: [
        "function TodoList({ todos }) {",
        "  return (",
        "    <ul>",
        "      {todos.map((todo) => (",
        '        <li key={todo.id} className="todo">{todo.title}</li>',
        "      ))}",
        "    </ul>",
        "  );",
        "}",
      ].join("\n"),
    },
    options: [
      { id: "a", text: "todo.id" },
      { id: "b", text: "Math.random()" },
      { id: "c", text: "A slug unique among the todos" },
      { id: "d", text: "The index, when the list is reordered" },
    ],
    correctOptionIds: ["a", "c"],
    explanation: "A key must be stable and unique among siblings.",
  },
} satisfies NextQuestionResponse;

/** A single-choice JavaScript question with a snippet. */
export const singleChoiceWithSnippet = {
  ...firstQuestion,
  question: {
    ...firstQuestion.question,
    snippet: {
      language: "javascript",
      source: [
        "// Counts the calls",
        "function makeCounter() {",
        "  let count = 0;",
        "  return () => ++count;",
        "}",
        "const counter = makeCounter();",
        "counter();",
        'console.log(counter(), "calls", true);',
      ].join("\n"),
    },
  },
} satisfies NextQuestionResponse;
