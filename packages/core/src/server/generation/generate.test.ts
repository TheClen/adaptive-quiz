import { LIMITS, NextQuestionResponse, type SessionState } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { levelHistory } from "../../adaptation.js";
import { selectNextConcept } from "../../selection.js";
import { ModelError } from "../model-errors.js";
import { buildRetryMessage, generationSystemPrompt, type RetryReason } from "../prompts/index.js";
import {
  FakeModelClient,
  type FakeModelStep,
  generationContext,
  multipleChoiceState,
  singleChoiceState,
  validMultipleDraft,
  validSingleDraft,
} from "../testing/index.js";
import type { ChoiceKind } from "./choice-rules.js";
import { ChoiceDraft, type ChoiceOptionDraft } from "./drafts.js";
import { generateQuestion, MAX_GENERATION_ATTEMPTS } from "./generate.js";

const wrong = (text: string) => ({ text, rationale: "Wrong.", correct: false });
const right = (text: string) => ({ text, rationale: "Right.", correct: true });

/** The state that asks for a question of `kind`. */
const STATES = {
  single: singleChoiceState,
  multiple: multipleChoiceState,
} as const satisfies Record<ChoiceKind, SessionState>;

const VALID = { single: validSingleDraft, multiple: validMultipleDraft } as const;

function withOptions(kind: ChoiceKind, options: readonly ChoiceOptionDraft[]) {
  return { ...VALID[kind], options };
}

/** The option at `index` of a fixture. */
function nth(options: readonly ChoiceOptionDraft[], index: number): ChoiceOptionDraft {
  const option = options[index];
  if (option === undefined) throw new Error(`No option ${String(index)}`);
  return option;
}

/** A broken draft, the kind it is generated for, and the rule it must break. */
interface BrokenCase {
  readonly name: string;
  readonly kind: ChoiceKind;
  readonly draft: unknown;
  readonly reason: RetryReason;
}

const single: readonly ChoiceOptionDraft[] = validSingleDraft.options;
const multiple: readonly ChoiceOptionDraft[] = validMultipleDraft.options;

const BROKEN: readonly BrokenCase[] = [
  {
    name: "single choice with 3 options",
    kind: "single",
    draft: withOptions("single", single.slice(0, 3)),
    reason: { rule: "option-count", count: 3 },
  },
  {
    name: "single choice with 5 options",
    kind: "single",
    draft: withOptions("single", [...single, wrong("null")]),
    reason: { rule: "option-count", count: 5 },
  },
  {
    name: "single choice with 0 correct",
    kind: "single",
    draft: withOptions("single", [wrong("2"), ...single.slice(1)]),
    reason: { rule: "correct-count", count: 0 },
  },
  {
    name: "single choice with 2 correct",
    kind: "single",
    draft: withOptions("single", [nth(single, 0), right("1"), ...single.slice(2)]),
    reason: { rule: "correct-count", count: 2 },
  },
  {
    name: "multiple choice with 3 options",
    kind: "multiple",
    draft: withOptions("multiple", multiple.slice(0, 3)),
    reason: { rule: "option-count", count: 3 },
  },
  {
    name: "multiple choice with 7 options",
    kind: "multiple",
    draft: withOptions("multiple", [...multiple, wrong("e"), wrong("f"), wrong("g")]),
    reason: { rule: "option-count", count: 7 },
  },
  {
    name: "multiple choice with 1 correct",
    kind: "multiple",
    draft: withOptions("multiple", [
      nth(multiple, 0),
      wrong("Closures copy values"),
      ...multiple.slice(2),
    ]),
    reason: { rule: "correct-count", count: 1 },
  },
  {
    name: "multiple choice with every option correct",
    kind: "multiple",
    draft: withOptions(
      "multiple",
      multiple.map((option) => ({ ...option, correct: true })),
    ),
    reason: { rule: "no-incorrect-option" },
  },
  {
    name: "duplicate option text, up to whitespace",
    kind: "single",
    draft: withOptions("single", [...single.slice(0, 3), wrong("  2 ")]),
    reason: { rule: "duplicate-options" },
  },
  {
    name: "duplicate option text in multiple choice",
    kind: "multiple",
    draft: withOptions("multiple", [...multiple, { ...nth(multiple, 3), correct: false }]),
    reason: { rule: "duplicate-options" },
  },
  {
    name: "oversized prompt",
    kind: "single",
    draft: { ...validSingleDraft, prompt: "x".repeat(LIMITS.prompt + 1) },
    reason: { rule: "field-too-long", field: "prompt", length: LIMITS.prompt + 1 },
  },
  {
    name: "oversized option",
    kind: "multiple",
    draft: withOptions("multiple", [
      ...multiple.slice(0, 3),
      wrong("y".repeat(LIMITS.optionText + 1)),
    ]),
    reason: { rule: "field-too-long", field: "option", length: LIMITS.optionText + 1 },
  },
  {
    name: "oversized explanation",
    kind: "single",
    draft: { ...validSingleDraft, explanation: "z".repeat(LIMITS.explanation + 1) },
    reason: { rule: "field-too-long", field: "explanation", length: LIMITS.explanation + 1 },
  },
  {
    name: "oversized snippet",
    kind: "single",
    draft: {
      ...validSingleDraft,
      snippet: { language: "javascript", source: "// x\n".repeat(LIMITS.code) },
    },
    reason: { rule: "field-too-long", field: "code", length: "// x\n".length * LIMITS.code },
  },
  {
    name: "JSX snippet in the JavaScript topic",
    kind: "single",
    draft: { ...validSingleDraft, snippet: { language: "jsx", source: "const a = <div />;" } },
    reason: { rule: "snippet-language" },
  },
  {
    name: "draft that does not match the schema",
    kind: "multiple",
    draft: { prompt: validMultipleDraft.prompt, options: multiple },
    reason: { rule: "invalid-output" },
  },
  {
    name: "option without a rationale",
    kind: "single",
    draft: withOptions("single", [{ text: "2", rationale: "", correct: true }, ...single.slice(1)]),
    reason: { rule: "invalid-output" },
  },
];

/** A state whose only previous stem nearly duplicates the valid multiple-choice draft. */
const nearDuplicateState = {
  ...multipleChoiceState,
  answers: [
    {
      kind: "single",
      conceptId: "closures",
      correct: false,
      stem: "Which statements about closures in JavaScript are correct?",
    },
  ],
} satisfies SessionState;

function fake(...outputs: unknown[]): FakeModelClient {
  return new FakeModelClient(outputs.map((output): FakeModelStep => ({ output })));
}

describe("generateQuestion: broken drafts", () => {
  it.each(BROKEN)(
    "rejects a $name, twice, with generation_failed",
    async ({ kind, draft, reason }) => {
      const model = fake(draft, draft);

      const result = await generateQuestion(generationContext(model), STATES[kind]);

      expect(result).toMatchObject({ ok: false, code: "generation_failed" });
      expect(result.attempts.map((attempt) => attempt.rejection)).toEqual([reason, reason]);
      expect(model.callCount).toBe(MAX_GENERATION_ATTEMPTS);
    },
  );

  it.each(BROKEN)("retries a $name, naming the broken rule", async ({ kind, draft, reason }) => {
    const model = fake(draft, VALID[kind]);

    const result = await generateQuestion(generationContext(model), STATES[kind]);

    expect(result.ok).toBe(true);
    expect(model.callCount).toBe(2);
    const [first, second] = model.requests;
    expect(first?.messages[0]?.content).not.toContain("<retry>");
    expect(second?.messages[0]?.content).toBe(
      `${String(first?.messages[0]?.content)}\n\n${buildRetryMessage(kind, reason)}`,
    );
  });

  it("rejects a stem that nearly duplicates a previous one (AC-5.3)", async () => {
    const model = fake(validMultipleDraft, validMultipleDraft);

    const result = await generateQuestion(generationContext(model), nearDuplicateState);

    expect(result.ok).toBe(false);
    expect(result.attempts[0]?.rejection).toEqual({ rule: "near-duplicate", question: 1 });
  });

  it("accepts JSX snippets in the React topic", async () => {
    const draft = {
      ...validSingleDraft,
      snippet: { language: "jsx", source: "const a = <div />;" },
    };
    const model = fake(draft);

    const result = await generateQuestion(generationContext(model), {
      ...singleChoiceState,
      topic: "react",
    });

    expect(result.ok).toBe(true);
  });
});

describe("generateQuestion: model failures", () => {
  it.each([
    ["refusal", { rule: "refusal" }],
    ["max_tokens", { rule: "max-tokens" }],
    ["invalid_output", { rule: "invalid-output" }],
  ] as const)("retries after a %s output", async (failure, reason) => {
    const model = new FakeModelClient([{ failure }, { output: validSingleDraft }]);

    const result = await generateQuestion(generationContext(model), singleChoiceState);

    expect(result.ok).toBe(true);
    expect(result.attempts.map((attempt) => attempt.rejection)).toEqual([reason, null]);
    expect(model.requests[1]?.messages[0]?.content).toContain(buildRetryMessage("single", reason));
  });

  it("gives generation_failed after two unusable outputs", async () => {
    const model = new FakeModelClient([{ failure: "refusal" }, { failure: "max_tokens" }]);

    const result = await generateQuestion(generationContext(model), singleChoiceState);

    expect(result).toMatchObject({ ok: false, code: "generation_failed" });
    expect(model.callCount).toBe(2);
  });

  it("lets upstream errors through without a retry", async () => {
    const error = new ModelError("ai_unavailable");
    const model = new FakeModelClient([{ error }]);

    await expect(generateQuestion(generationContext(model), singleChoiceState)).rejects.toBe(error);
    expect(model.callCount).toBe(1);
  });

  it("lets an upstream error on the retry through", async () => {
    const error = new ModelError("budget_exhausted");
    const model = new FakeModelClient([{ failure: "refusal" }, { error }]);

    await expect(generateQuestion(generationContext(model), singleChoiceState)).rejects.toBe(error);
    expect(model.callCount).toBe(2);
  });
});

describe("generateQuestion: valid drafts", () => {
  it.each(["single", "multiple"] as const)(
    "returns a valid %s-choice draft after one call",
    async (kind) => {
      const model = fake(VALID[kind]);

      const result = await generateQuestion(generationContext(model), STATES[kind]);

      if (!result.ok) throw new Error("Expected a question");
      expect(model.callCount).toBe(1);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toMatchObject({ model: "claude-haiku-5-5", rejection: null });
      expect(NextQuestionResponse.parse(result.response)).toEqual(result.response);
      expect(result.response.question.kind).toBe(kind);
    },
  );

  it("sends the cached system prompt, the choice route and the draft schema", async () => {
    const model = fake(validMultipleDraft);

    await generateQuestion(generationContext(model), multipleChoiceState);

    expect(model.requests[0]).toMatchObject({
      route: "choice",
      system: generationSystemPrompt("javascript", "multiple"),
      schema: ChoiceDraft,
    });
  });

  it("asks for the derived concept, marks a revisit and lists previous stems", async () => {
    const missed = {
      ...multipleChoiceState,
      answers: multipleChoiceState.answers.map((answer) => ({ ...answer, correct: false })),
    } satisfies SessionState;
    const model = fake(validMultipleDraft);

    const result = await generateQuestion(generationContext(model), missed);

    if (!result.ok) throw new Error("Expected a question");
    expect(result.response.conceptId).toBe("promises");
    expect(result.response.conceptLabel).toBe("Promises");
    const content = model.requests[0]?.messages[0]?.content;
    expect(content).toContain("Revisit: yes");
    expect(content).toContain("When does the callback passed to then run?");
  });

  it("takes the position, level and concept from the state, not from the model", async () => {
    const state = {
      version: 1,
      topic: "javascript",
      seed: 7,
      answers: [
        { kind: "single", conceptId: "closures", correct: true, stem: "First question?" },
        { kind: "multiple", conceptId: "promises", correct: true, stem: "Second question?" },
      ],
    } satisfies SessionState;
    const model = fake(validSingleDraft);

    const result = await generateQuestion(generationContext(model), state);

    if (!result.ok) throw new Error("Expected a question");
    expect(result.response.position).toBe(3);
    expect(result.response.level).toBe(levelHistory(state.answers).at(-1));
    expect(result.response.level).toBe(5);
    expect(result.response.conceptId).toBe(
      selectNextConcept(state.topic, state.seed, state.answers).concept.id,
    );
  });

  it("keeps the answer key through the shuffle and drops the rationales", async () => {
    const model = fake(validMultipleDraft);

    const result = await generateQuestion(generationContext(model), multipleChoiceState);

    if (!result.ok || result.response.question.kind !== "multiple") {
      throw new Error("Expected a multiple-choice question");
    }
    const { options, correctOptionIds } = result.response.question;
    expect(options.map((option) => option.id)).toEqual(["a", "b", "c", "d"]);
    const correctTexts = options
      .filter((option) => correctOptionIds.includes(option.id))
      .map((option) => option.text);
    expect(correctTexts.sort()).toEqual(
      validMultipleDraft.options
        .filter((option) => option.correct)
        .map((option) => option.text)
        .sort(),
    );
    expect(JSON.stringify(result.response)).not.toContain("rationale");
  });

  it("shuffles the same way for the same seed and position", async () => {
    const first = await generateQuestion(
      generationContext(fake(validSingleDraft)),
      singleChoiceState,
    );
    const second = await generateQuestion(
      generationContext(fake(validSingleDraft)),
      singleChoiceState,
    );

    expect(first).toEqual(second);
  });

  it("does not always put the correct option first", async () => {
    const correctIds = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const result = await generateQuestion(generationContext(fake(validSingleDraft)), {
        ...singleChoiceState,
        seed,
      });
      if (result.ok && result.response.question.kind === "single") {
        correctIds.add(result.response.question.correctOptionId);
      }
    }

    expect([...correctIds].sort()).toEqual(["a", "b", "c", "d"]);
  });
});
