import { LIMITS, type QuestionKind } from "@ai-in-learning/shared-types";

import { block } from "./quoting.js";

/** A construct the static checks forbid in exercise code (plan §8.4 step 3, AC-3.7). */
export type ForbiddenConstruct =
  | "import"
  | "export"
  | "require"
  | "jsx"
  | "hook"
  | "react-namespace"
  | "document"
  | "window"
  | "fetch"
  | "set-timeout"
  | "async"
  | "await"
  | "math-random"
  | "date-now";

/** A field with a length limit (plan §8.4 step 2). */
export type LimitedField = "prompt" | "option" | "explanation" | "code" | "test-description";

/**
 * Why the first draft was rejected (plan §8.4). It carries only enums and numbers,
 * never text, so the retry message cannot contain anything the client or the model
 * wrote (plan §8.3, ADR 0004).
 */
export type RetryReason =
  | { readonly rule: "invalid-output" }
  | { readonly rule: "max-tokens" }
  | { readonly rule: "refusal" }
  | { readonly rule: "option-count"; readonly count: number }
  | { readonly rule: "correct-count"; readonly count: number }
  | { readonly rule: "no-incorrect-option" }
  | { readonly rule: "duplicate-options" }
  | { readonly rule: "field-too-long"; readonly field: LimitedField }
  | { readonly rule: "snippet-language" }
  /** `question` is the 1-based line of the similar stem in `<previous_questions>`. */
  | { readonly rule: "near-duplicate"; readonly question: number }
  | {
      readonly rule: "forbidden-construct";
      readonly construct: ForbiddenConstruct;
      readonly in: "starter-code" | "reference-solution";
    }
  /** `test` is 1-based, in the order of the draft's tests. */
  | {
      readonly rule: "invalid-test-json";
      readonly test: number;
      readonly field: "args" | "expected";
    }
  | { readonly rule: "args-not-array"; readonly test: number }
  | { readonly rule: "test-too-large"; readonly test: number }
  | { readonly rule: "reference-failed"; readonly test: number }
  | { readonly rule: "starter-passes" };

const CONSTRUCTS = {
  import: "an `import` statement",
  export: "an `export` statement",
  require: "`require()`",
  jsx: "JSX",
  hook: "a hook call",
  "react-namespace": "the `React` namespace",
  document: "`document`",
  window: "`window`",
  fetch: "`fetch`",
  "set-timeout": "a timer",
  async: "`async`",
  await: "`await`",
  "math-random": "`Math.random`",
  "date-now": "`Date.now`",
} as const satisfies Record<ForbiddenConstruct, string>;

const FIELDS = {
  prompt: ["The question", LIMITS.prompt],
  option: ["An option", LIMITS.optionText],
  explanation: ["The explanation", LIMITS.explanation],
  code: ["A piece of code", LIMITS.code],
  "test-description": ["A test description", LIMITS.testDescription],
} as const satisfies Record<LimitedField, readonly [string, number]>;

/** A count written by the server. `Math.trunc` keeps it a plain integer. */
function n(value: number): string {
  return String(Math.trunc(value));
}

function options(count: number): string {
  return count === 1 ? "1 option" : `${n(count)} options`;
}

/** The server-written sentence naming the rule that failed. */
function ruleSentence(kind: QuestionKind, reason: RetryReason): string {
  switch (reason.rule) {
    case "invalid-output":
      return "It did not match the required output format.";
    case "max-tokens":
      return "It was cut off because it was too long. Keep the new item shorter.";
    case "refusal":
      return "It did not contain a quiz item.";
    case "option-count":
      return kind === "single"
        ? `It had ${options(reason.count)}; a single-choice question needs exactly 4.`
        : `It had ${options(reason.count)}; a multiple-choice question needs 4 to 6.`;
    case "correct-count":
      return kind === "single"
        ? `It marked ${options(reason.count)} as correct; exactly 1 must be correct.`
        : `It marked ${options(reason.count)} as correct; at least 2 must be correct.`;
    case "no-incorrect-option":
      return "Every option was correct; at least 1 must be incorrect.";
    case "duplicate-options":
      return "Two options had the same text.";
    case "field-too-long": {
      const [name, limit] = FIELDS[reason.field];
      return `${name} was longer than ${limit.toLocaleString("en-US")} characters.`;
    }
    case "snippet-language":
      return 'The snippet language was wrong: use "jsx" only for a React snippet that contains JSX.';
    case "near-duplicate":
      return `It was too similar to previous question ${n(reason.question)}. Write a clearly different one.`;
    case "forbidden-construct":
      return `The ${reason.in === "starter-code" ? "starter code" : "reference solution"} used ${CONSTRUCTS[reason.construct]}, which exercises must not use.`;
    case "invalid-test-json":
      return reason.field === "args"
        ? `The arguments of test ${n(reason.test)} were not valid JSON.`
        : `The expected value of test ${n(reason.test)} was not valid JSON.`;
    case "args-not-array":
      return `The arguments of test ${n(reason.test)} were not a JSON array.`;
    case "test-too-large":
      return `Test ${n(reason.test)} was larger than ${LIMITS.testJson.toLocaleString("en-US")} characters of JSON.`;
    case "reference-failed":
      return `The reference solution failed test ${n(reason.test)}.`;
    case "starter-passes":
      return "The starter code already passed every test; it must fail at least one.";
  }
}

/**
 * The retry block appended to the second generation call (plan §8.3). It names the
 * rule that failed in a server-written sentence and never includes client text.
 */
export function buildRetryMessage(kind: QuestionKind, reason: RetryReason): string {
  return block("retry", [
    `Your previous item was rejected. ${ruleSentence(kind, reason)}`,
    "Write a new item that follows every rule.",
  ]);
}
