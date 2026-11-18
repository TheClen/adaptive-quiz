import { levelHistory } from "@ai-in-learning/core";
import {
  hashIp,
  type IpHash,
  ModelError,
  type ModelErrorCode,
  RATE_LIMITS,
  rateLimitKey,
  verifyExercise,
} from "@ai-in-learning/core/server";
import {
  FakeModelClient,
  type FakeModelStep,
  javascriptCodeState,
  MemoryRateLimiter,
  multipleChoiceState,
  singleChoiceState,
  TEST_SIGNING_SECRET,
  testRunner,
  validJavaScriptCodeDraft,
  validMultipleDraft,
  validSingleDraft,
} from "@ai-in-learning/core/server/testing";
import {
  ApiError,
  type ErrorCode,
  NextQuestionResponse,
  type SessionState,
} from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { type App, createApp } from "../app.js";
import { loadEnv } from "../env.js";
import { ERROR_CATALOGUE } from "../http/errors.js";
import type { RequestLogLine } from "../http/logging.js";
import { UNKNOWN_CLIENT } from "../http/rate-limits.js";

const ENV = loadEnv({
  ANTHROPIC_API_KEY: "sk-ant-fake",
  UPSTASH_REDIS_REST_URL: "https://fake-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "fake-token",
  QUIZ_SIGNING_SECRET: TEST_SIGNING_SECRET,
});

const IP = "203.0.113.7";

/** A choice draft that breaks the option-count rule. */
const brokenSingleDraft = { ...validSingleDraft, options: validSingleDraft.options.slice(0, 3) };

interface Setup {
  readonly app: App;
  readonly model: FakeModelClient;
  readonly limiter: MemoryRateLimiter;
  readonly lines: RequestLogLine[];
}

function setup(steps: readonly FakeModelStep[] = []): Setup {
  const model = new FakeModelClient(steps);
  const limiter = new MemoryRateLimiter();
  const lines: RequestLogLine[] = [];
  const app = createApp({
    env: ENV,
    createServices: () => ({
      model,
      rateLimiter: limiter,
      runner: testRunner,
      signingSecret: TEST_SIGNING_SECRET,
    }),
    log: (line) => lines.push(line),
  });
  return { app, model, limiter, lines };
}

async function post(app: App, body: unknown, ip: string | null = IP): Promise<Response> {
  return await app.request("/api/quiz/next-question", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ip === null ? {} : { "x-forwarded-for": ip }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function expectApiError(response: Response, code: ErrorCode): Promise<ApiError> {
  expect(response.status).toBe(ERROR_CATALOGUE[code].status);
  const body = ApiError.parse(await response.json());
  expect(body.error.code).toBe(code);
  return body;
}

/** Uses up `count` tokens of a limit, as earlier requests would have. */
async function consume(limiter: MemoryRateLimiter, count: number, limit: "questions" | "global") {
  const ipHash = await hashIp(IP);
  for (let i = 0; i < count; i += 1) {
    await limiter.consume(limit === "global" ? { limit } : { limit, ipHash });
  }
}

function keys(ipHash: IpHash) {
  return {
    sessions: rateLimitKey({ limit: "sessions", ipHash }),
    questions: rateLimitKey({ limit: "questions", ipHash }),
    global: rateLimitKey({ limit: "global" }),
  };
}

describe("POST /api/quiz/next-question", () => {
  describe("a valid request", () => {
    it("returns question 1 at level 3 for a new session", async () => {
      const { app, model, limiter } = setup([{ output: validSingleDraft }]);
      const response = await post(app, { state: singleChoiceState });

      expect(response.status).toBe(200);
      const body = NextQuestionResponse.parse(await response.json());
      expect(body).toMatchObject({ position: 1, level: 3, question: { kind: "single" } });
      expect(model.callCount).toBe(1);

      const expected = keys(await hashIp(IP));
      expect(limiter.keys).toEqual([expected.sessions, expected.questions, expected.global]);
    });

    it.each([
      ["one correct answer", multipleChoiceState],
      [
        "one incorrect answer",
        {
          ...multipleChoiceState,
          answers: multipleChoiceState.answers.map((answer) => ({ ...answer, correct: false })),
        },
      ],
    ])("takes the level from the answers, whatever the model returns (%s)", async (_, state) => {
      const { app } = setup([{ output: { ...validMultipleDraft, level: 1, position: 9 } }]);
      const response = await post(app, { state });

      expect(response.status).toBe(200);
      const body = NextQuestionResponse.parse(await response.json());
      expect(body.position).toBe(2);
      expect(body.level).toBe(levelHistory(state.answers).at(-1));
    });

    it("returns a signed code exercise at position 4", async () => {
      const { app } = setup([{ output: validJavaScriptCodeDraft }]);
      const response = await post(app, { state: javascriptCodeState });

      expect(response.status).toBe(200);
      const body = NextQuestionResponse.parse(await response.json());
      expect(body.position).toBe(4);
      if (body.question.kind !== "code") throw new Error("Expected a code exercise");
      expect(await verifyExercise(TEST_SIGNING_SECRET, body.question)).toBe(true);
    });

    it("logs the model, the attempts and the usage, never the visitor's stems", async () => {
      const { app, lines } = setup([{ output: brokenSingleDraft }, { output: validMultipleDraft }]);
      await post(app, { state: multipleChoiceState });

      expect(lines).toMatchObject([
        {
          path: "/api/quiz/next-question",
          status: 200,
          outcome: "ok",
          model: "claude-haiku-5-5",
          attempts: 2,
          rejections: ["option-count"],
          usage: { inputTokens: 0, outputTokens: 0 },
        },
      ]);
      const stem = multipleChoiceState.answers[0]?.stem ?? "";
      expect(stem).not.toBe("");
      expect(JSON.stringify(lines)).not.toContain(stem);
    });
  });

  describe("an invalid request", () => {
    const complete: SessionState = {
      ...singleChoiceState,
      answers: Array.from({ length: 10 }, () => ({
        kind: "single" as const,
        conceptId: "closures" as const,
        correct: true,
        stem: "What does this closure log?",
      })),
    };

    it.each([
      ["malformed JSON", "{ not json"],
      ["no state", {}],
      ["an unknown version", { state: { ...singleChoiceState, version: 2 } }],
      [
        "an answer whose kind does not match the schedule",
        {
          state: {
            ...multipleChoiceState,
            answers: multipleChoiceState.answers.map((answer) => ({ ...answer, kind: "code" })),
          },
        },
      ],
      [
        "a concept from the other topic",
        {
          state: {
            ...multipleChoiceState,
            answers: multipleChoiceState.answers.map((answer) => ({
              ...answer,
              conceptId: "use-effect",
            })),
          },
        },
      ],
      ["a complete session", { state: complete }],
    ])("rejects %s with invalid_request before any limit or model call", async (_, body) => {
      const { app, model, limiter } = setup([{ output: validSingleDraft }]);

      await expectApiError(await post(app, body), "invalid_request");
      expect(model.callCount).toBe(0);
      expect(limiter.keys).toEqual([]);
    });
  });

  describe("rate limits", () => {
    it("refuses the 6th session in an hour with 429, Retry-After and retryAfterSeconds", async () => {
      const sessions = RATE_LIMITS.sessions.tokens;
      const { app, model } = setup(
        Array.from({ length: sessions }, () => ({ output: validSingleDraft })),
      );
      for (let i = 0; i < sessions; i += 1) {
        expect((await post(app, { state: singleChoiceState })).status).toBe(200);
      }

      const response = await post(app, { state: singleChoiceState });
      const body = await expectApiError(response, "rate_limited");
      expect(body.error.retryAfterSeconds).toBeGreaterThan(0);
      expect(response.headers.get("retry-after")).toBe(String(body.error.retryAfterSeconds));
      expect(model.callCount).toBe(sessions);
    });

    it("counts other visitors separately", async () => {
      const sessions = RATE_LIMITS.sessions.tokens;
      const { app } = setup(
        Array.from({ length: sessions + 1 }, () => ({ output: validSingleDraft })),
      );
      for (let i = 0; i < sessions; i += 1) {
        await post(app, { state: singleChoiceState });
      }

      expect((await post(app, { state: singleChoiceState }, "198.51.100.1")).status).toBe(200);
    });

    it("lets forged non-empty states skip the session counter but not the questions limit", async () => {
      const { app, model, limiter } = setup([{ output: validMultipleDraft }]);
      await consume(limiter, RATE_LIMITS.questions.tokens - 1, "questions");

      // The 60th question of the hour still goes through, without counting a session.
      expect((await post(app, { state: multipleChoiceState })).status).toBe(200);
      expect(limiter.keys).not.toContain(keys(await hashIp(IP)).sessions);

      const body = await expectApiError(
        await post(app, { state: multipleChoiceState }),
        "rate_limited",
      );
      expect(body.error.retryAfterSeconds).toBeGreaterThan(0);
      expect(model.callCount).toBe(1);
    });

    it("returns budget_exhausted once the global cap is reached, without calling the model", async () => {
      const { app, model, limiter } = setup([{ output: validSingleDraft }]);
      await consume(limiter, RATE_LIMITS.global.tokens, "global");

      await expectApiError(await post(app, { state: singleChoiceState }), "budget_exhausted");
      expect(model.callCount).toBe(0);
    });

    it("counts every model call against the global cap, the retry included", async () => {
      const { app, limiter } = setup([{ output: brokenSingleDraft }, { output: validSingleDraft }]);
      await post(app, { state: singleChoiceState });

      const global = keys(await hashIp(IP)).global;
      expect(limiter.keys.filter((key) => key === global)).toHaveLength(2);
    });

    it("refuses the retry when the global cap is reached between the two calls", async () => {
      const { app, model, limiter } = setup([
        { output: brokenSingleDraft },
        { output: validSingleDraft },
      ]);
      await consume(limiter, RATE_LIMITS.global.tokens - 1, "global");

      await expectApiError(await post(app, { state: singleChoiceState }), "budget_exhausted");
      expect(model.callCount).toBe(1);
    });

    it("fails closed with ai_unavailable when the limiter cannot answer", async () => {
      const { app, model, limiter } = setup([{ output: validSingleDraft }]);
      limiter.unavailable = true;

      await expectApiError(await post(app, { state: singleChoiceState }), "ai_unavailable");
      expect(model.callCount).toBe(0);
    });

    it("counts requests without x-forwarded-for in one shared bucket", async () => {
      const { app, limiter, lines } = setup([{ output: validSingleDraft }]);

      expect((await post(app, { state: singleChoiceState }, null)).status).toBe(200);
      const shared = keys(await hashIp(UNKNOWN_CLIENT));
      expect(limiter.keys).toEqual([shared.sessions, shared.questions, shared.global]);
      expect(lines[0]?.ipHash).toBeNull();
    });
  });

  describe("model failures", () => {
    it.each([
      ["ai_unavailable", 503],
      ["budget_exhausted", 503],
      ["internal", 500],
    ] as const satisfies readonly (readonly [ModelErrorCode, number])[])(
      "maps a %s model error to the catalogue",
      async (code, status) => {
        const { app, model } = setup([{ error: new ModelError(code, { status: 529 }) }]);
        const response = await post(app, { state: singleChoiceState });

        expect(response.status).toBe(status);
        await expectApiError(response, code);
        expect(model.callCount).toBe(1);
      },
    );

    it("returns generation_failed after two invalid drafts", async () => {
      const { app, model, lines } = setup([{ output: brokenSingleDraft }, { failure: "refusal" }]);

      await expectApiError(await post(app, { state: singleChoiceState }), "generation_failed");
      expect(model.callCount).toBe(2);
      expect(lines).toMatchObject([
        { outcome: "generation_failed", attempts: 2, rejections: ["option-count", "refusal"] },
      ]);
    });
  });
});
