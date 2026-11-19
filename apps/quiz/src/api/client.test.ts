import type { ApiError, NextQuestionRequest } from "@ai-in-learning/shared-types";
import { describe, expect, it, vi } from "vitest";

import { firstQuestion, sessionWithThreeAnswers } from "../testing/fixtures.js";
import {
  ApiClientError,
  createFetchApiClient,
  REQUEST_TIMEOUT_MS,
  toRequestFailure,
} from "./client.js";

const request: NextQuestionRequest = { state: sessionWithThreeAnswers };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clientReturning(response: Response) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  return { fetch, client: createFetchApiClient({ fetch }) };
}

/** A fetch that never answers, and rejects like the real one when its signal aborts. */
function hangingFetch(): typeof globalThis.fetch {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(init.signal?.reason as Error);
      });
    });
}

async function failureOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiClientError);
  return toRequestFailure(error);
}

describe("createFetchApiClient", () => {
  it("posts the request as JSON to the same-origin API path", async () => {
    const { fetch, client } = clientReturning(jsonResponse(firstQuestion));

    await client.nextQuestion(request);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("/api/quiz/next-question");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(typeof init?.body === "string" ? JSON.parse(init.body) : init?.body).toEqual(request);
  });

  it("resolves with the parsed response", async () => {
    const { client } = clientReturning(jsonResponse(firstQuestion));

    await expect(client.nextQuestion(request)).resolves.toEqual(firstQuestion);
  });

  it("posts code reviews to their own path", async () => {
    const review = {
      review: { summary: "Fine.", comments: [{ aspect: "readability", text: "Ok." }] },
    };
    const { fetch, client } = clientReturning(jsonResponse(review));

    await expect(
      client.codeReview({
        topic: "javascript",
        conceptId: "array-methods",
        level: 3,
        exercise: {
          kind: "code",
          prompt: "Write `sum(numbers)`.",
          functionName: "sum",
          starterCode: "function sum(numbers) {}",
          tests: [
            { id: "t1", description: "a", args: [[1]], expected: 1, checksImmutability: false },
            { id: "t2", description: "b", args: [[]], expected: 0, checksImmutability: false },
            { id: "t3", description: "c", args: [[1, 2]], expected: 3, checksImmutability: true },
          ],
          referenceSolution: "function sum(n) { return n.reduce((a, b) => a + b, 0); }",
          explanation: "Use reduce.",
          exerciseToken: "dG9rZW4",
        },
        code: "function sum(n) { return 0; }",
      }),
    ).resolves.toEqual(review);
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/quiz/code-review");
  });

  it("treats a response that does not match its schema as internal", async () => {
    const { client } = clientReturning(jsonResponse({ ...firstQuestion, position: 11 }));

    expect(await failureOf(client.nextQuestion(request))).toEqual({ code: "internal" });
  });

  it("treats a successful response that is not JSON as internal", async () => {
    const { client } = clientReturning(new Response("<html>ok</html>", { status: 200 }));

    expect(await failureOf(client.nextQuestion(request))).toEqual({ code: "internal" });
  });

  it("keeps the code and the wait of an ApiError body", async () => {
    const body: ApiError = {
      error: { code: "rate_limited", message: "Too many requests.", retryAfterSeconds: 1_200 },
    };
    const { client } = clientReturning(jsonResponse(body, 429));

    expect(await failureOf(client.nextQuestion(request))).toEqual({
      code: "rate_limited",
      retryAfterSeconds: 1_200,
    });
  });

  it("drops the message of an error body, whatever it contains (AC-8.4)", async () => {
    const body: ApiError = {
      error: {
        code: "ai_unavailable",
        message: "sk-ant-api03-leak at Object.<anonymous> (x.js:1)",
      },
    };
    const { client } = clientReturning(jsonResponse(body, 503));

    const error = await client.nextQuestion(request).catch((reason: unknown) => reason);

    expect(toRequestFailure(error)).toEqual({ code: "ai_unavailable" });
    expect(String(error)).not.toContain("sk-ant");
  });

  it("treats an error response that is not an ApiError as internal", async () => {
    const { client } = clientReturning(new Response("Bad Gateway", { status: 502 }));

    expect(await failureOf(client.nextQuestion(request))).toEqual({ code: "internal" });
  });

  it("treats a network failure as internal", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    const client = createFetchApiClient({ fetch });

    expect(await failureOf(client.nextQuestion(request))).toEqual({ code: "internal" });
  });

  it("times out after 65 seconds by default", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(65_000);
  });

  it("aborts a request that takes too long and reports ai_unavailable (AC-8.1)", async () => {
    vi.useFakeTimers();
    try {
      const client = createFetchApiClient({ fetch: hangingFetch() });
      const pending = failureOf(client.nextQuestion(request));

      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

      expect(await pending).toEqual({ code: "ai_unavailable" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects with the abort reason when the caller aborts", async () => {
    const client = createFetchApiClient({ fetch: hangingFetch() });
    const controller = new AbortController();
    const pending = client.nextQuestion(request, { signal: controller.signal });
    const reason = new DOMException("Left the session", "AbortError");

    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it("does not send a request whose signal is already aborted", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = createFetchApiClient({ fetch });

    await expect(client.nextQuestion(request, { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("toRequestFailure", () => {
  it("is internal for anything that is not an ApiClientError", () => {
    expect(toRequestFailure(new Error("boom"))).toEqual({ code: "internal" });
  });
});
