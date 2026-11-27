import {
  type CodeExercise,
  LIMITS,
  NextQuestionResponse,
  type SessionState,
} from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { createRunner } from "../../runner/index.js";
import { verifyExercise } from "../exercise-token.js";
import { buildRetryMessage, generationSystemPrompt, type RetryReason } from "../prompts/index.js";
import {
  FakeModelClient,
  type FakeModelStep,
  generationContext,
  javascriptCodeState,
  reactCodeState,
  TEST_SIGNING_SECRET,
  validJavaScriptCodeDraft,
  validReactCodeDraft,
} from "../testing/index.js";
import { CodeExerciseDraft, type CodeTestDraft } from "./drafts.js";
import { generateQuestion, MAX_GENERATION_ATTEMPTS } from "./generate.js";

type Topic = SessionState["topic"];

const STATES = { javascript: javascriptCodeState, react: reactCodeState } as const;
const VALID = { javascript: validJavaScriptCodeDraft, react: validReactCodeDraft } as const;

function fake(...outputs: unknown[]): FakeModelClient {
  return new FakeModelClient(outputs.map((output): FakeModelStep => ({ output })));
}

function withTests(topic: Topic, change: (tests: CodeTestDraft[]) => CodeTestDraft[]) {
  return { ...VALID[topic], tests: change([...VALID[topic].tests]) };
}

function withTest(topic: Topic, index: number, change: Partial<CodeTestDraft>) {
  return withTests(topic, (tests) =>
    tests.map((test, at) => (at === index ? { ...test, ...change } : test)),
  );
}

/** Puts `line` at the start of the body of a function declaration. */
function inject(code: string, line: string): string {
  return code.replace("{\n", `{\n  ${line}\n`);
}

function codeQuestion(response: NextQuestionResponse): CodeExercise {
  if (response.question.kind !== "code") throw new Error("Expected a code exercise");
  return response.question;
}

interface BrokenCase {
  readonly name: string;
  readonly topic: Topic;
  readonly draft: unknown;
  readonly reason: RetryReason;
}

const react = validReactCodeDraft;

const BROKEN: readonly BrokenCase[] = [
  {
    name: "reference solution that fails one test (AC-3.6)",
    topic: "javascript",
    draft: withTest("javascript", 1, { expectedJson: '{"a": [], "b": []}' }),
    reason: { rule: "reference-failed", test: 2 },
  },
  {
    name: "reference solution that changes its input",
    topic: "react",
    draft: {
      ...react,
      referenceSolution:
        'function todosReducer(state, action) {\n  if (action.type === "added") {\n    state.push({ id: action.id, text: action.text, done: false });\n    return state.slice();\n  }\n  return state.map((todo) => (todo.id === action.id ? { ...todo, done: !todo.done } : todo));\n}\n',
    },
    reason: { rule: "reference-failed", test: 1 },
  },
  {
    name: "reference solution with a syntax error",
    topic: "javascript",
    draft: { ...validJavaScriptCodeDraft, referenceSolution: "function groupBy(items, key) {" },
    reason: { rule: "reference-failed", test: 1 },
  },
  {
    name: "starter code that already passes",
    topic: "react",
    draft: { ...react, starterCode: react.referenceSolution },
    reason: { rule: "starter-passes" },
  },
  {
    name: "React reference solution with JSX",
    topic: "react",
    draft: {
      ...react,
      referenceSolution: inject(react.referenceSolution, "const item = <li>{action.text}</li>;"),
    },
    reason: { rule: "forbidden-construct", construct: "jsx", in: "reference-solution" },
  },
  {
    name: "React starter code with a hook",
    topic: "react",
    draft: { ...react, starterCode: inject(react.starterCode, "const [todos] = useState(state);") },
    reason: { rule: "forbidden-construct", construct: "hook", in: "starter-code" },
  },
  {
    name: "React reference solution with a hook",
    topic: "react",
    draft: {
      ...react,
      referenceSolution: inject(react.referenceSolution, "const total = useMemo(() => 1, []);"),
    },
    reason: { rule: "forbidden-construct", construct: "hook", in: "reference-solution" },
  },
  {
    name: "React draft with an import",
    topic: "react",
    draft: { ...react, starterCode: `import { produce } from "immer";\n${react.starterCode}` },
    reason: { rule: "forbidden-construct", construct: "import", in: "starter-code" },
  },
  {
    name: "React draft with the React namespace",
    topic: "react",
    draft: {
      ...react,
      referenceSolution: inject(react.referenceSolution, "React.startTransition(() => {});"),
    },
    reason: { rule: "forbidden-construct", construct: "react-namespace", in: "reference-solution" },
  },
  {
    name: "React draft with a timer",
    topic: "react",
    draft: {
      ...react,
      referenceSolution: inject(react.referenceSolution, "setTimeout(() => {}, 0);"),
    },
    reason: { rule: "forbidden-construct", construct: "set-timeout", in: "reference-solution" },
  },
  {
    name: "React draft with async",
    topic: "react",
    draft: { ...react, referenceSolution: `async ${react.referenceSolution}` },
    reason: { rule: "forbidden-construct", construct: "async", in: "reference-solution" },
  },
  {
    name: "JavaScript draft with fetch",
    topic: "javascript",
    draft: {
      ...validJavaScriptCodeDraft,
      referenceSolution: inject(validJavaScriptCodeDraft.referenceSolution, "fetch(key);"),
    },
    reason: { rule: "forbidden-construct", construct: "fetch", in: "reference-solution" },
  },
  {
    name: "malformed argsJson",
    topic: "javascript",
    draft: withTest("javascript", 1, { argsJson: '[[{"type": }], "type"]' }),
    reason: { rule: "invalid-test-json", test: 2, field: "args" },
  },
  {
    name: "argsJson that is not an array",
    topic: "javascript",
    draft: withTest("javascript", 0, { argsJson: '{"items": []}' }),
    reason: { rule: "args-not-array", test: 1 },
  },
  {
    name: "malformed expectedJson",
    topic: "react",
    draft: withTest("react", 2, { expectedJson: "[{id: 1}]" }),
    reason: { rule: "invalid-test-json", test: 3, field: "expected" },
  },
  {
    name: "test larger than its JSON limit",
    topic: "javascript",
    draft: withTest("javascript", 2, {
      argsJson: JSON.stringify([[{ type: "x".repeat(LIMITS.testJson) }], "type"]),
    }),
    reason: { rule: "test-too-large", test: 3 },
  },
  {
    name: "oversized reference solution",
    topic: "javascript",
    draft: {
      ...validJavaScriptCodeDraft,
      referenceSolution: `${validJavaScriptCodeDraft.referenceSolution}${"//\n".repeat(LIMITS.code)}`,
    },
    reason: {
      rule: "field-too-long",
      field: "code",
      length: validJavaScriptCodeDraft.referenceSolution.length + "//\n".length * LIMITS.code,
    },
  },
  {
    name: "oversized test description",
    topic: "javascript",
    draft: withTest("javascript", 0, { description: "d".repeat(LIMITS.testDescription + 1) }),
    reason: {
      rule: "field-too-long",
      field: "test-description",
      length: LIMITS.testDescription + 1,
    },
  },
  {
    name: "oversized prompt",
    topic: "react",
    draft: { ...react, prompt: "p".repeat(LIMITS.prompt + 1) },
    reason: { rule: "field-too-long", field: "prompt", length: LIMITS.prompt + 1 },
  },
  {
    name: "draft with 2 tests",
    topic: "javascript",
    draft: withTests("javascript", (tests) => tests.slice(0, 2)),
    reason: { rule: "invalid-output" },
  },
  {
    name: "draft with 7 tests",
    topic: "javascript",
    draft: withTests("javascript", (tests) => [...tests, ...tests, ...tests.slice(0, 1)]),
    reason: { rule: "invalid-output" },
  },
  {
    name: "function name that is not an identifier",
    topic: "javascript",
    draft: { ...validJavaScriptCodeDraft, functionName: "group-by" },
    reason: { rule: "invalid-output" },
  },
  {
    name: "draft that does not match the schema",
    topic: "javascript",
    draft: { ...validJavaScriptCodeDraft, tests: "[]" },
    reason: { rule: "invalid-output" },
  },
];

describe("generateQuestion: broken code exercise drafts", () => {
  it.each(BROKEN)(
    "rejects a $name, twice, with generation_failed",
    async ({ topic, draft, reason }) => {
      const model = fake(draft, draft);

      const result = await generateQuestion(generationContext(model), STATES[topic]);

      expect(result).toMatchObject({ ok: false, code: "generation_failed" });
      expect(result).not.toHaveProperty("response");
      expect(result.attempts.map((attempt) => attempt.rejection)).toEqual([reason, reason]);
      expect(model.callCount).toBe(MAX_GENERATION_ATTEMPTS);
    },
  );

  it.each(BROKEN)(
    "retries a $name and returns the valid draft",
    async ({ topic, draft, reason }) => {
      const model = fake(draft, VALID[topic]);

      const result = await generateQuestion(generationContext(model), STATES[topic]);

      if (!result.ok) throw new Error("Expected a question");
      expect(model.callCount).toBe(2);
      expect(model.requests[1]?.messages[0]?.content).toContain(buildRetryMessage("code", reason));
      expect(codeQuestion(result.response).referenceSolution).toBe(VALID[topic].referenceSolution);
    },
  );

  it("rejects a statement that nearly duplicates a previous one (AC-5.3)", async () => {
    const state = {
      ...javascriptCodeState,
      answers: javascriptCodeState.answers.map((answer, index) =>
        index === 1 ? { ...answer, stem: validJavaScriptCodeDraft.prompt.slice(0, 200) } : answer,
      ),
    } satisfies SessionState;
    const model = fake(validJavaScriptCodeDraft, validJavaScriptCodeDraft);

    const result = await generateQuestion(generationContext(model), state);

    expect(result.ok).toBe(false);
    expect(result.attempts[0]?.rejection).toEqual({ rule: "near-duplicate", question: 2 });
  });

  it("rejects a reference solution that loops forever", async () => {
    const runner = createRunner({ timeoutMs: 100 });
    const looping = {
      ...validJavaScriptCodeDraft,
      referenceSolution: "function groupBy(items, key) {\n  for (;;) {}\n}\n",
    };
    const model = fake(looping, looping);

    const result = await generateQuestion(
      { ...generationContext(model), runner },
      javascriptCodeState,
    );

    expect(result.ok).toBe(false);
    expect(result.attempts[0]?.rejection).toEqual({ rule: "reference-failed", test: 1 });
  });
});

describe("generateQuestion: valid code exercises", () => {
  it.each(["javascript", "react"] as const)(
    "returns a valid %s exercise after one call",
    async (topic) => {
      const model = fake(VALID[topic]);

      const result = await generateQuestion(generationContext(model), STATES[topic]);

      if (!result.ok) throw new Error("Expected a question");
      expect(model.callCount).toBe(1);
      expect(result.attempts.map(({ model, rejection }) => ({ model, rejection }))).toEqual([
        { model: "claude-haiku-5-5", rejection: null },
      ]);
      expect(NextQuestionResponse.parse(result.response)).toEqual(result.response);
      expect(result.response.position).toBe(4);
    },
  );

  it("sends the cached system prompt, the code route and the draft schema", async () => {
    const model = fake(validReactCodeDraft);

    await generateQuestion(generationContext(model), reactCodeState);

    expect(model.requests[0]).toMatchObject({
      route: "code",
      system: generationSystemPrompt("react", "code"),
      schema: CodeExerciseDraft,
    });
  });

  it("parses the test JSON and assigns test ids", async () => {
    const result = await generateQuestion(
      generationContext(fake(validJavaScriptCodeDraft)),
      javascriptCodeState,
    );

    if (!result.ok) throw new Error("Expected a question");
    const exercise = codeQuestion(result.response);
    expect(exercise).toMatchObject({
      kind: "code",
      prompt: validJavaScriptCodeDraft.prompt,
      functionName: "groupBy",
      starterCode: validJavaScriptCodeDraft.starterCode,
      referenceSolution: validJavaScriptCodeDraft.referenceSolution,
      explanation: validJavaScriptCodeDraft.explanation,
    });
    expect(exercise.tests).toEqual(
      validJavaScriptCodeDraft.tests.map((test, index) => ({
        id: `t${String(index + 1)}`,
        description: test.description,
        args: JSON.parse(test.argsJson) as unknown,
        expected: JSON.parse(test.expectedJson) as unknown,
        checksImmutability: test.checksImmutability,
      })),
    );
  });

  it("returns an exercise whose token verifies, and fails after any change", async () => {
    const result = await generateQuestion(
      generationContext(fake(validReactCodeDraft)),
      reactCodeState,
    );

    if (!result.ok) throw new Error("Expected a question");
    const exercise = codeQuestion(result.response);
    await expect(verifyExercise(TEST_SIGNING_SECRET, exercise)).resolves.toBe(true);
    await expect(
      verifyExercise(TEST_SIGNING_SECRET, { ...exercise, explanation: "Changed." }),
    ).resolves.toBe(false);
    await expect(
      verifyExercise(TEST_SIGNING_SECRET, { ...exercise, tests: exercise.tests.slice(1) }),
    ).resolves.toBe(false);
    await expect(verifyExercise("another-secret", exercise)).resolves.toBe(false);
  });

  it("drops the draft's JSON text from the response", async () => {
    const result = await generateQuestion(
      generationContext(fake(validJavaScriptCodeDraft)),
      javascriptCodeState,
    );

    expect(JSON.stringify(result)).not.toMatch(/argsJson|expectedJson/u);
  });
});
