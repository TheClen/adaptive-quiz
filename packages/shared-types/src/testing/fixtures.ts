/**
 * Valid fixtures for the schema tests. Excluded from the build.
 */
import type {
  CodeExercise,
  MultipleChoiceQuestion,
  SessionState,
  SingleChoiceQuestion,
} from "../index.js";

export const singleChoice = {
  kind: "single",
  prompt: "What does `typeof null` return?",
  snippet: { language: "javascript", source: "console.log(typeof null);" },
  options: [
    { id: "a", text: '"null"' },
    { id: "b", text: '"object"' },
    { id: "c", text: '"undefined"' },
    { id: "d", text: "It throws a TypeError" },
  ],
  correctOptionId: "b",
  explanation: '`typeof null` is `"object"`, a historical quirk of the language.',
} satisfies SingleChoiceQuestion;

export const multipleChoice = {
  kind: "multiple",
  prompt: "Which of these create a block scope?",
  snippet: null,
  options: [
    { id: "a", text: "An `if` block" },
    { id: "b", text: "A `for` loop with `let`" },
    { id: "c", text: "An object literal" },
    { id: "d", text: "A bare `{}` block" },
  ],
  correctOptionIds: ["a", "b", "d"],
  explanation: "Blocks create scopes for `let` and `const`; object literals do not.",
} satisfies MultipleChoiceQuestion;

export const codeExercise = {
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
} satisfies CodeExercise;

export const sessionState = {
  version: 1,
  topic: "javascript",
  seed: 123_456_789,
  answers: [
    { kind: "single", conceptId: "closures", correct: true, stem: "What does this closure log?" },
    {
      kind: "multiple",
      conceptId: "promises",
      correct: false,
      stem: "Which calls return a promise?",
    },
  ],
} satisfies SessionState;
