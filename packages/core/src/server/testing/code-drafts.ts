import type { SessionState } from "@ai-in-learning/shared-types";

import { createRunner, RUN_TIMEOUT_MS } from "../../runner/index.js";
import type { CodeExerciseDraft } from "../generation/drafts.js";
import type { GenerationContext } from "../generation/generate.js";
import type { ModelClient } from "../model-client.js";

/** A signing secret for tests only. */
export const TEST_SIGNING_SECRET = "test-only-signing-secret-0123456789abcdef";

/**
 * One server runner shared by the tests: it uses the real QuickJS build (ADR 0005)
 * and loads it once.
 */
export const testRunner = createRunner({ timeoutMs: RUN_TIMEOUT_MS.server });

/** A generation context around `model`, with the test runner and secret. */
export function generationContext(model: ModelClient): GenerationContext {
  return { model, runner: testRunner, signingSecret: TEST_SIGNING_SECRET };
}

/** A valid JavaScript code exercise draft. Its words in comments and strings are not code. */
export const validJavaScriptCodeDraft = {
  prompt:
    'Write `groupBy(items, key)`. It returns an object that maps each value of `item[key]` to the items with that value, in their original order. Example: `groupBy([{ type: "a" }], "type")` returns `{ a: [{ type: "a" }] }`.',
  functionName: "groupBy",
  starterCode:
    "function groupBy(items, key) {\n  // Return an object that maps each key value to its items.\n  // Do not export or import anything.\n}\n",
  referenceSolution:
    "function groupBy(items, key) {\n  const groups = {};\n  for (const item of items) {\n    const value = item[key];\n    (groups[value] ??= []).push(item);\n  }\n  return groups;\n}\n",
  tests: [
    {
      description: "Returns an empty object for an empty list",
      argsJson: '[[], "type"]',
      expectedJson: "{}",
      checksImmutability: false,
    },
    {
      description: "Groups items by the value of the key, keeping their order",
      argsJson: '[[{"type": "a", "n": 1}, {"type": "b", "n": 2}, {"type": "a", "n": 3}], "type"]',
      expectedJson:
        '{"a": [{"type": "a", "n": 1}, {"type": "a", "n": 3}], "b": [{"type": "b", "n": 2}]}',
      checksImmutability: false,
    },
    {
      description: "Does not change the list it receives",
      argsJson: '[[{"type": "x"}], "type"]',
      expectedJson: '{"x": [{"type": "x"}]}',
      checksImmutability: true,
    },
  ],
  explanation:
    "The solution walks the list once and appends each item to the array of its key value, creating the array on first use.",
} satisfies CodeExerciseDraft;

/** A valid React code exercise draft: a reducer, with action types that read like code. */
export const validReactCodeDraft = {
  prompt:
    'Write the reducer `todosReducer(state, action)` for a list of todos. Handle `{ type: "added", id, text }` and `{ type: "toggled", id }`, and return the state unchanged for any other action. Never change the state you receive.',
  functionName: "todosReducer",
  starterCode:
    'function todosReducer(state, action) {\n  // Handle "added" and "toggled"; return the state otherwise.\n  return state;\n}\n',
  referenceSolution: [
    "function todosReducer(state, action) {",
    "  switch (action.type) {",
    '    case "added":',
    "      return [...state, { id: action.id, text: action.text, done: false }];",
    '    case "toggled":',
    "      return state.map((todo) =>",
    "        todo.id === action.id ? { ...todo, done: !todo.done } : todo,",
    "      );",
    "    default:",
    "      return state;",
    "  }",
    "}",
    "",
  ].join("\n"),
  tests: [
    {
      description: "Adds a todo that is not done",
      argsJson: '[[], {"type": "added", "id": 1, "text": "Read"}]',
      expectedJson: '[{"id": 1, "text": "Read", "done": false}]',
      checksImmutability: true,
    },
    {
      description: "Toggles only the todo with the given id",
      argsJson:
        '[[{"id": 1, "text": "Read", "done": false}, {"id": 2, "text": "Write", "done": false}], {"type": "toggled", "id": 2}]',
      expectedJson:
        '[{"id": 1, "text": "Read", "done": false}, {"id": 2, "text": "Write", "done": true}]',
      checksImmutability: true,
    },
    {
      description: "Returns the state unchanged for an unknown action",
      argsJson: '[[{"id": 1, "text": "Read", "done": true}], {"type": "fetch/started"}]',
      expectedJson: '[{"id": 1, "text": "Read", "done": true}]',
      checksImmutability: false,
    },
  ],
  explanation:
    "Each case returns a new array: spreading adds a todo, and map replaces the toggled todo with a copy. Unknown actions return the same state.",
} satisfies CodeExerciseDraft;

const firstThreeAnswers = {
  javascript: [
    { kind: "single", conceptId: "closures", correct: true, stem: "What does this closure log?" },
    {
      kind: "multiple",
      conceptId: "promises",
      correct: true,
      stem: "Which statements about promises are true?",
    },
    { kind: "single", conceptId: "functions", correct: true, stem: "What does bind return?" },
  ],
  react: [
    { kind: "single", conceptId: "refs", correct: true, stem: "When is a ref updated?" },
    {
      kind: "multiple",
      conceptId: "context",
      correct: true,
      stem: "Which statements about context are true?",
    },
    {
      kind: "single",
      conceptId: "memoization",
      correct: true,
      stem: "When does useMemo recompute?",
    },
  ],
} as const satisfies Record<SessionState["topic"], SessionState["answers"]>;

/** A JavaScript session state whose next question is a code exercise (position 4). */
export const javascriptCodeState = {
  version: 1,
  topic: "javascript",
  seed: 42,
  answers: [...firstThreeAnswers.javascript],
} satisfies SessionState;

/** A React session state whose next question is a code exercise (position 4). */
export const reactCodeState = {
  version: 1,
  topic: "react",
  seed: 42,
  answers: [...firstThreeAnswers.react],
} satisfies SessionState;
