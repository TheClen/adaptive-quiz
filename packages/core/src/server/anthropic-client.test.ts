import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createAnthropicModelClient } from "./anthropic-client.js";
import type { ModelRequest } from "./model-client.js";
import { MODEL_ROUTES, type ModelRoute } from "./model-config.js";
import { ModelError } from "./model-errors.js";
import { errorResponse, messageResponse } from "./testing/sdk-responses.js";

const Draft = z.object({ answer: z.string().max(20) });

function request(route: ModelRoute = "choice"): ModelRequest<z.infer<typeof Draft>> {
  return {
    route,
    system: "You write quiz questions.",
    messages: [{ role: "user", content: "<request>topic: javascript</request>" }],
    schema: Draft,
  };
}

/** A fake `fetch` that answers with the given responses in order and records each request body. */
function fakeFetch(...responses: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(
      JSON.parse(typeof init?.body === "string" ? init.body : "null") as Record<string, unknown>,
    );
    const next = responses.shift();
    return next === undefined
      ? Promise.reject(new Error("Unexpected request"))
      : Promise.resolve(next());
  });
  return { fetch, bodies };
}

function client(fetch: typeof globalThis.fetch) {
  return createAnthropicModelClient({ apiKey: "test-key", fetch });
}

const valid = () => messageResponse({ text: JSON.stringify({ answer: "b" }) });
/** Retried at once, so the tests do not wait for the SDK's backoff. */
const overloaded = () =>
  errorResponse(529, "overloaded_error", "Overloaded", { headers: { "retry-after-ms": "1" } });

describe("createAnthropicModelClient: request", () => {
  it.each(["choice", "code", "review"] as const)("sends the %s route parameters", async (route) => {
    const { fetch, bodies } = fakeFetch(valid);

    await client(fetch).generate(request(route));

    const config = MODEL_ROUTES[route];
    expect(bodies[0]).toMatchObject({
      model: config.model,
      max_tokens: config.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: config.effort, format: { type: "json_schema" } },
      system: [
        { type: "text", text: "You write quiz questions.", cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: "<request>topic: javascript</request>" }],
    });
  });

  it.each(["choice", "code", "review"] as const)(
    "sends no sampling parameters and no fallbacks on the %s route",
    async (route) => {
      const { fetch, bodies } = fakeFetch(valid);

      await client(fetch).generate(request(route));

      for (const key of ["temperature", "top_p", "top_k", "fallbacks"]) {
        expect(bodies[0]).not.toHaveProperty(key);
      }
    },
  );

  it("sends the output schema derived from the Zod draft schema", async () => {
    const { fetch, bodies } = fakeFetch(valid);

    await client(fetch).generate(request());

    expect(bodies[0]).toMatchObject({
      output_config: {
        format: { schema: { type: "object", properties: { answer: { type: "string" } } } },
      },
    });
  });

  it("retries a transient error once", async () => {
    const { fetch } = fakeFetch(overloaded, valid);

    const result = await client(fetch).generate(request());

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry and throws ai_unavailable", async () => {
    const { fetch } = fakeFetch(overloaded, overloaded, valid);

    await expect(client(fetch).generate(request())).rejects.toMatchObject({
      name: "ModelError",
      code: "ai_unavailable",
      status: 529,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("createAnthropicModelClient: timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts each attempt after the route timeout and throws ai_unavailable", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const outcome = client(fetch)
      .generate(request("choice"))
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(MODEL_ROUTES.choice.timeoutMs - 1);
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3 * MODEL_ROUTES.choice.timeoutMs);
    const error = await outcome;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(ModelError);
    expect(error).toMatchObject({ code: "ai_unavailable" });
  });
});

describe("createAnthropicModelClient: response", () => {
  it("returns the parsed output with the model and token usage", async () => {
    const { fetch } = fakeFetch(valid);

    const result = await client(fetch).generate(request());

    expect(result).toEqual({
      ok: true,
      output: { answer: "b" },
      model: "claude-haiku-5-5",
      usage: {
        inputTokens: 120,
        outputTokens: 340,
        cacheReadInputTokens: 900,
        cacheCreationInputTokens: 0,
      },
    });
  });

  it("treats a refusal as invalid output, even with parseable text", async () => {
    const { fetch } = fakeFetch(() =>
      messageResponse({ text: JSON.stringify({ answer: "b" }), stopReason: "refusal" }),
    );

    const result = await client(fetch).generate(request());

    expect(result).toMatchObject({ ok: false, reason: "refusal" });
  });

  it("treats output cut by max_tokens as invalid output", async () => {
    const { fetch } = fakeFetch(() =>
      messageResponse({ text: '{"answer": "b', stopReason: "max_tokens" }),
    );

    const result = await client(fetch).generate(request());

    expect(result).toMatchObject({ ok: false, reason: "max_tokens" });
  });

  it.each([
    ["is not JSON", "Here is your question: ..."],
    ["breaks a schema constraint", JSON.stringify({ answer: "x".repeat(21) })],
    ["misses a field", JSON.stringify({})],
  ])("treats output that %s as invalid output", async (_name, text) => {
    const { fetch } = fakeFetch(() => messageResponse({ text }));

    const result = await client(fetch).generate(request());

    expect(result).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("throws a mapped error for an upstream failure", async () => {
    const { fetch } = fakeFetch(() => errorResponse(402, "billing_error", "Payment required"));

    await expect(client(fetch).generate(request())).rejects.toMatchObject({
      name: "ModelError",
      code: "budget_exhausted",
    });
  });
});
