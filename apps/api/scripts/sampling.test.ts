import { KIND_SCHEDULE } from "@ai-in-learning/core";
import type {
  ModelClient,
  ModelRequest,
  ModelResult,
  ModelUsage,
} from "@ai-in-learning/core/server";
import { ModelError } from "@ai-in-learning/core/server";
import {
  TEST_SIGNING_SECRET,
  testRunner,
  validJavaScriptCodeDraft,
} from "@ai-in-learning/core/server/testing";
import { describe, expect, it } from "vitest";

import {
  MAX_TRIES_PER_POSITION,
  planLevels,
  renderReviewSheet,
  type SampledSession,
  sampleSession,
  SESSION_PLANS,
  sessionCalls,
  totals,
} from "./sampling.js";

const USAGE: ModelUsage = {
  inputTokens: 1_000,
  outputTokens: 2_000,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
};

const WORDS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
];

/** A distinct prompt per question, so the near-duplicate check never fires. */
function prompt(index: number): string {
  const word = WORDS[index] ?? "kilo";
  return `Which ${word} statement about the ${word} sample holds for ${word}?`;
}

function option(text: string, correct: boolean) {
  return { text, rationale: `Because ${text} is ${correct ? "right" : "wrong"}.`, correct };
}

/**
 * Answers each generation call with a valid draft of the kind the schedule gives that
 * call (every draft is accepted first time), and each review with a short review.
 */
class SessionModel implements ModelClient {
  readonly routes: string[] = [];
  #questions = 0;

  generate<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    this.routes.push(request.route);
    const output = this.#output(request.route);
    const parsed = request.schema.parse(output);
    return Promise.resolve({ ok: true, output: parsed, model: "claude-haiku-5-5", usage: USAGE });
  }

  #output(route: string): unknown {
    if (route === "review") {
      return {
        summary: "Clear and correct.",
        comments: [{ aspect: "readability", text: "Reads well." }],
      };
    }
    const index = this.#questions;
    this.#questions += 1;
    const kind = KIND_SCHEDULE[index];
    if (kind === "code") {
      return index < 5
        ? validJavaScriptCodeDraft
        : {
            ...validJavaScriptCodeDraft,
            prompt:
              "Implement groupBy so it buckets records under the value each one has for a given property name.",
          };
    }
    const options =
      kind === "single"
        ? [option("One", true), option("Two", false), option("Three", false), option("Four", false)]
        : [option("One", true), option("Two", true), option("Three", false), option("Four", false)];
    return { prompt: prompt(index), snippet: null, options, explanation: "Because." };
  }
}

/** Every call returns output that fails the schema. */
const invalidModel: ModelClient = {
  generate: () =>
    Promise.resolve({
      ok: false,
      reason: "invalid_output",
      model: "claude-haiku-5-5",
      usage: USAGE,
    }),
};

function context(model: ModelClient) {
  return { model, runner: testRunner, signingSecret: TEST_SIGNING_SECRET };
}

describe("SESSION_PLANS", () => {
  it("gives 30 questions per topic covering every level", () => {
    expect(SESSION_PLANS).toHaveLength(3);
    const levels = SESSION_PLANS.flatMap((plan) => planLevels(plan));
    expect(levels).toHaveLength(30);
    expect(new Set(levels)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("puts code exercises at more than one level", () => {
    const codeLevels = SESSION_PLANS.flatMap((plan) =>
      planLevels(plan).filter((_, index) => KIND_SCHEDULE[index] === "code"),
    );
    expect(new Set(codeLevels).size).toBeGreaterThan(2);
  });
});

describe("sampleSession", () => {
  it("plays a full session through the pipeline with the plan's answers", async () => {
    const plan = SESSION_PLANS[0];
    const model = new SessionModel();
    const session = await sampleSession(context(model), "javascript", plan);

    expect(session.stoppedBy).toBeNull();
    expect(session.questions.map((question) => question.response?.question.kind)).toEqual([
      ...KIND_SCHEDULE,
    ]);
    expect(session.questions.map((question) => question.response?.level)).toEqual(planLevels(plan));
    // The plan's misses bring their concepts back later in the session.
    expect(session.questions.some((question) => question.revisit)).toBe(true);
    expect(session.reviews.map((review) => [review.position, review.outcome])).toEqual([
      [4, "accepted"],
      [8, "accepted"],
    ]);
    expect(model.routes.filter((route) => route === "review")).toHaveLength(2);
  });

  it("keeps each option's rationale next to the shuffled option", async () => {
    const session = await sampleSession(
      context(new SessionModel()),
      "javascript",
      SESSION_PLANS[1],
    );
    const first = session.questions[0];
    const question = first?.response?.question;
    if (question === undefined || question.kind === "code") throw new Error("Expected a choice");
    question.options.forEach((option, index) => {
      expect(first?.rationales[index]).toContain(option.text);
    });
  });

  it("stops after the visitor's retries when a position keeps failing", async () => {
    const session = await sampleSession(context(invalidModel), "react", SESSION_PLANS[2]);

    expect(session.questions).toHaveLength(1);
    expect(session.questions[0]?.response).toBeNull();
    expect(session.questions[0]?.tries).toHaveLength(MAX_TRIES_PER_POSITION);
    expect(session.stoppedBy).toBe(`question 1 failed ${String(MAX_TRIES_PER_POSITION)} times`);
    // Each try is the first draft plus the automatic retry.
    expect(sessionCalls(session)).toHaveLength(MAX_TRIES_PER_POSITION * 2);
  });

  it("counts ai_unavailable as a try and lets other upstream errors abort the run", async () => {
    const unavailable: ModelClient = {
      generate: () => Promise.reject(new ModelError("ai_unavailable")),
    };
    const session = await sampleSession(context(unavailable), "javascript", SESSION_PLANS[0]);
    expect(session.questions[0]?.tries.map((attempt) => attempt.outcome)).toEqual(
      Array.from({ length: MAX_TRIES_PER_POSITION }, () => "upstream_error"),
    );

    const exhausted: ModelClient = {
      generate: () => Promise.reject(new ModelError("budget_exhausted")),
    };
    await expect(sampleSession(context(exhausted), "javascript", SESSION_PLANS[0])).rejects.toThrow(
      ModelError,
    );
  });
});

describe("usage and review sheet", () => {
  async function fullSession(): Promise<SampledSession> {
    return sampleSession(context(new SessionModel()), "javascript", SESSION_PLANS[0]);
  }

  it("prices every generation and review call of a session", async () => {
    const sum = totals(sessionCalls(await fullSession()));
    // 10 questions and 2 reviews, each 1,000 input and 2,000 output tokens at $0.10 / $0.50.
    expect(sum.calls).toBe(12);
    expect(sum.inputTokens).toBe(12_000);
    expect(sum.outputTokens).toBe(24_000);
    expect(sum.costUsd).toBeCloseTo(12 * (0.0001 + 0.001), 10);
  });

  it("reports an unknown cost for a model without a price", () => {
    const sum = totals([{ model: "some-other-model", usage: USAGE }]);
    expect(sum.costUsd).toBeNull();
  });

  it("lists every question with its answers and an empty verdict", async () => {
    const session = await fullSession();
    const sheet = renderReviewSheet({
      startedAt: "2026-11-19T10:00:00.000Z",
      commit: "abc1234",
      sessions: [session],
    });

    expect(sheet).toContain("## Topic: javascript");
    expect(sheet).toContain("### 1. Session A, question 1: single, level 3");
    expect(sheet).toContain("### 10. Session A, question 10");
    expect(sheet).toContain("✅");
    expect(sheet).toContain("_Rationale:_ Because One is right.");
    expect(sheet).toContain("Reference solution:");
    expect(sheet.match(/\*\*Verdict:\*\*/gu)).toHaveLength(10);
    expect(sheet).toContain("| A | 10 | 12 | 12000 | 24000 | 0 | 0 | $0.0132 |");
  });
});
