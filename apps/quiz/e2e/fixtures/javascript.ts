import type { QuestionFixture, QuizFixture } from "./types.js";

/** Position 4: a code exercise whose starter code passes one test of three. */
export const countVowelsExercise = {
  conceptId: "strings",
  conceptLabel: "Strings",
  question: {
    kind: "code",
    prompt:
      "Write `countVowels(text)`, which returns how many vowels (a, e, i, o, u) the text contains, in any case.",
    functionName: "countVowels",
    starterCode: [
      "function countVowels(text) {",
      "  // Count a, e, i, o and u, in any case",
      "  return 0;",
      "}",
    ].join("\n"),
    tests: [
      {
        id: "lowercase",
        description: 'countVowels("hello") returns 2',
        args: ["hello"],
        expected: 2,
        checksImmutability: false,
      },
      {
        id: "empty",
        description: 'countVowels("") returns 0',
        args: [""],
        expected: 0,
        checksImmutability: false,
      },
      {
        id: "uppercase",
        description: 'countVowels("AEIOU") returns 5',
        args: ["AEIOU"],
        expected: 5,
        checksImmutability: false,
      },
    ],
    referenceSolution: [
      "function countVowels(text) {",
      '  return [...text.toLowerCase()].filter((char) => "aeiou".includes(char)).length;',
      "}",
    ].join("\n"),
    explanation:
      "Lowercasing first means one comparison per character. Spreading a string gives its characters, which `filter` keeps when they are vowels.",
    exerciseToken: "e2e-fixture-count-vowels",
  },
} as const satisfies QuestionFixture;

/** Position 8: a code exercise whose starter code mutates its argument. */
const withItemExercise = {
  conceptId: "immutability-and-copying",
  conceptLabel: "Immutability and copying",
  question: {
    kind: "code",
    prompt:
      "Write `withItem(list, item)`, which returns a new array with `item` added at the end. The original array must not change.",
    functionName: "withItem",
    starterCode: [
      "function withItem(list, item) {",
      "  list.push(item);",
      "  return list;",
      "}",
    ].join("\n"),
    tests: [
      {
        id: "numbers",
        description: "withItem([1, 2], 3) returns [1, 2, 3] and leaves [1, 2] unchanged",
        args: [[1, 2], 3],
        expected: [1, 2, 3],
        checksImmutability: true,
      },
      {
        id: "empty",
        description: 'withItem([], "a") returns ["a"] and leaves [] unchanged',
        args: [[], "a"],
        expected: ["a"],
        checksImmutability: true,
      },
      {
        id: "nested",
        description: "withItem([[1]], [2]) returns [[1], [2]] and leaves [[1]] unchanged",
        args: [[[1]], [2]],
        expected: [[1], [2]],
        checksImmutability: true,
      },
    ],
    referenceSolution: ["function withItem(list, item) {", "  return [...list, item];", "}"].join(
      "\n",
    ),
    explanation:
      "`push` changes the array it is called on. Spreading the list into a new array literal copies it, so the caller's array stays as it was.",
    exerciseToken: "e2e-fixture-with-item",
  },
} as const satisfies QuestionFixture;

/** A JavaScript session: what the API returns for each of the 10 positions. */
export const javascript: QuizFixture = {
  topic: "javascript",
  questions: [
    {
      conceptId: "closures",
      conceptLabel: "Closures",
      question: {
        kind: "single",
        prompt: "What does this code log?",
        snippet: {
          language: "javascript",
          source: [
            "function makeCounter() {",
            "  let count = 0;",
            "  return () => ++count;",
            "}",
            "const counter = makeCounter();",
            "counter();",
            "console.log(counter());",
          ].join("\n"),
        },
        options: [
          { id: "a", text: "1" },
          { id: "b", text: "2" },
          { id: "c", text: "undefined" },
          { id: "d", text: "It throws a ReferenceError" },
        ],
        correctOptionId: "b",
        explanation:
          "The returned function closes over `count`, which keeps its value between calls: the second call returns 2.",
      },
    },
    {
      conceptId: "array-methods",
      conceptLabel: "Array methods",
      question: {
        kind: "multiple",
        prompt: "Which of these array methods return a new array?",
        snippet: null,
        options: [
          { id: "a", text: "map" },
          { id: "b", text: "forEach" },
          { id: "c", text: "filter" },
          { id: "d", text: "push" },
        ],
        correctOptionIds: ["a", "c"],
        explanation:
          "`map` and `filter` build a new array. `forEach` returns undefined, and `push` changes the array and returns its new length.",
      },
    },
    {
      conceptId: "types-and-coercion",
      conceptLabel: "Types and coercion",
      question: {
        kind: "single",
        prompt: "What does `typeof null` evaluate to?",
        snippet: null,
        options: [
          { id: "a", text: '"null"' },
          { id: "b", text: '"undefined"' },
          { id: "c", text: '"object"' },
          { id: "d", text: "It throws a TypeError" },
        ],
        correctOptionId: "c",
        explanation:
          'A long-standing quirk of the language: `typeof null` is "object". Check for null with `value === null`.',
      },
    },
    countVowelsExercise,
    {
      conceptId: "scope-and-hoisting",
      conceptLabel: "Scope and hoisting",
      question: {
        kind: "single",
        prompt: "What does this code log?",
        snippet: { language: "javascript", source: "console.log(x);\nvar x = 1;" },
        options: [
          { id: "a", text: "1" },
          { id: "b", text: "undefined" },
          { id: "c", text: "It throws a ReferenceError" },
          { id: "d", text: "null" },
        ],
        correctOptionId: "b",
        explanation:
          "A `var` declaration is hoisted and initialised to undefined. Only the assignment stays where it is written.",
      },
    },
    {
      conceptId: "async-await",
      conceptLabel: "Async/await",
      question: {
        kind: "multiple",
        prompt: "Which statements about async functions are true?",
        snippet: null,
        options: [
          { id: "a", text: "They always return a promise" },
          { id: "b", text: "`await` pauses the whole page until the promise settles" },
          { id: "c", text: "An error thrown inside one rejects the promise it returns" },
          { id: "d", text: "`await` can be used on a value that is not a promise" },
        ],
        correctOptionIds: ["a", "c", "d"],
        explanation:
          "An async function wraps its result in a promise, and a throw rejects it. `await` only pauses that function, and it accepts any value.",
      },
    },
    {
      conceptId: "event-loop",
      conceptLabel: "Event loop",
      question: {
        kind: "single",
        prompt: "In what order are the letters logged?",
        snippet: {
          language: "javascript",
          source: [
            'setTimeout(() => console.log("A"), 0);',
            'Promise.resolve().then(() => console.log("B"));',
            'console.log("C");',
          ].join("\n"),
        },
        options: [
          { id: "a", text: "A, B, C" },
          { id: "b", text: "C, A, B" },
          { id: "c", text: "C, B, A" },
          { id: "d", text: "B, C, A" },
        ],
        correctOptionId: "c",
        explanation:
          "Synchronous code runs first, then microtasks such as promise callbacks, then tasks such as timers.",
      },
    },
    withItemExercise,
    {
      conceptId: "maps-and-sets",
      conceptLabel: "Maps and sets",
      question: {
        kind: "multiple",
        prompt: "Which statements about `Map` are true?",
        snippet: null,
        options: [
          { id: "a", text: "Its keys can be objects" },
          { id: "b", text: "Its keys are converted to strings" },
          { id: "c", text: "It iterates in insertion order" },
          { id: "d", text: "It has a `size` property" },
        ],
        correctOptionIds: ["a", "c", "d"],
        explanation:
          "Unlike plain objects, a `Map` keeps keys of any type as they are, remembers insertion order and tracks its `size`.",
      },
    },
    {
      conceptId: "modules",
      conceptLabel: "Modules",
      question: {
        kind: "single",
        prompt: 'What does `import config from "./config.js"` import?',
        snippet: null,
        options: [
          { id: "a", text: "The default export of the module" },
          { id: "b", text: "An object with every named export" },
          { id: "c", text: "The export named `config`" },
          { id: "d", text: "The module's source code as a string" },
        ],
        correctOptionId: "a",
        explanation:
          "An import without braces binds the default export, under any name. Named exports need braces, and `import * as` gives the namespace object.",
      },
    },
  ],
  reviews: {
    countVowels: {
      summary: "A clear one-line solution that handles both cases.",
      comments: [
        { aspect: "correctness", text: "Lowercasing first covers uppercase vowels." },
        { aspect: "readability", text: "The chain reads in the order the work happens." },
      ],
    },
    withItem: {
      summary: "The function changes the array it receives.",
      comments: [
        { aspect: "correctness", text: "`push` mutates `list`, so the caller sees the new item." },
        { aspect: "idiomatic", text: "Return `[...list, item]` to build a new array instead." },
      ],
    },
  },
};
