/**
 * Fixtures for the quiz tests. Not imported by the app, so never bundled.
 */
import type { TestResult } from "@ai-in-learning/core/runner";
import type {
  CodeReviewResponse,
  NextQuestionResponse,
  SessionState,
} from "@ai-in-learning/shared-types";

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

/** The second question of a JavaScript session: multiple choice. */
export const secondQuestion = {
  position: 2,
  level: 4,
  conceptId: "array-methods",
  conceptLabel: "Array methods",
  question: {
    kind: "multiple",
    prompt: "Which methods return a new array?",
    snippet: null,
    options: [
      { id: "a", text: "map" },
      { id: "b", text: "forEach" },
      { id: "c", text: "filter" },
      { id: "d", text: "push" },
    ],
    correctOptionIds: ["a", "c"],
    explanation:
      "`map` and `filter` build a new array; `forEach` returns undefined and `push` mutates.",
  },
} satisfies NextQuestionResponse;

/**
 * A JavaScript session after nine answers, following the kind schedule, at
 * level 4: right, wrong, right, wrong, right, wrong, right, wrong, right.
 */
export const sessionWithNineAnswers = {
  version: 1,
  topic: "javascript",
  seed: 42,
  answers: (
    [
      ["single", "closures"],
      ["multiple", "array-methods"],
      ["single", "promises"],
      ["code", "array-methods"],
      ["single", "this-binding"],
      ["multiple", "maps-and-sets"],
      ["single", "event-loop"],
      ["code", "closures"],
      ["multiple", "strings"],
    ] as const
  ).map(([kind, conceptId], index) => ({
    kind,
    conceptId,
    correct: index % 2 === 0,
    stem: `Question ${String(index + 1)} about ${conceptId}`,
  })),
} satisfies SessionState;

/** The 10th and last question of {@link sessionWithNineAnswers}. */
export const lastQuestion = {
  ...firstQuestion,
  position: 10,
  level: 4,
} satisfies NextQuestionResponse;

/**
 * {@link sessionWithNineAnswers} with {@link lastQuestion} answered correctly:
 * 6 out of 10, final level 5. Closures, missed on its 8th question, is mastered
 * by its latest attempt (AC-7.2).
 */
export const completeSession = {
  ...sessionWithNineAnswers,
  answers: [
    ...sessionWithNineAnswers.answers,
    { kind: "single", conceptId: "closures", correct: true, stem: lastQuestion.question.prompt },
  ],
} satisfies SessionState;

/** A complete React session with every answer correct: nothing to review. */
export const perfectSession = {
  version: 1,
  topic: "react",
  seed: 7,
  answers: Array.from({ length: 10 }, (_, index) => ({
    kind: "single" as const,
    conceptId: index % 2 === 0 ? "reducers" : "refs",
    correct: true,
    stem: `Question ${String(index + 1)}`,
  })),
} satisfies SessionState;

/** A JavaScript code exercise at position 4, the first code slot of the schedule. */
export const codeQuestion = {
  position: 4,
  level: 4,
  conceptId: "array-methods",
  conceptLabel: "Array methods",
  question: {
    kind: "code",
    prompt: "Write `sum(numbers)` that returns the sum of an array of numbers.",
    functionName: "sum",
    starterCode: "function sum(numbers) {\n  // Your code here\n}",
    tests: [
      {
        id: "t1",
        description: "Sums three numbers",
        args: [[1, 2, 3]],
        expected: 6,
        checksImmutability: false,
      },
      {
        id: "t2",
        description: "Returns 0 for an empty array",
        args: [[]],
        expected: 0,
        checksImmutability: false,
      },
      {
        id: "t3",
        description: "Does not change its input",
        args: [[4, 5]],
        expected: 9,
        checksImmutability: true,
      },
    ],
    referenceSolution:
      "function sum(numbers) {\n  return numbers.reduce((total, n) => total + n, 0);\n}",
    explanation: "`reduce` with an initial value of 0 also handles the empty array.",
    exerciseToken: "c2lnbmF0dXJl",
  },
} satisfies NextQuestionResponse;

/** Results of {@link codeQuestion} where every test passes. */
export const passingResults = [
  { testId: "t1", passed: true },
  { testId: "t2", passed: true },
  { testId: "t3", passed: true },
] as const satisfies readonly TestResult[];

/** Results of {@link codeQuestion} where the empty-array test fails. */
export const failingResults = [
  { testId: "t1", passed: true },
  { testId: "t2", passed: false, reason: "Expected 0 but got undefined" },
  { testId: "t3", passed: true },
] as const satisfies readonly TestResult[];

/** A review that calls the code wrong, to check that it never changes the verdict (AC-6.3). */
export const negativeReview = {
  review: {
    summary: "This solution is wrong: it does not compute the sum.",
    comments: [
      { aspect: "correctness", text: "The loop skips the last element." },
      { aspect: "readability", text: "Name the accumulator `total` rather than `t`." },
      { aspect: "idiomatic", text: "`reduce` expresses a sum more directly than a `for` loop." },
    ],
  },
} satisfies CodeReviewResponse;
