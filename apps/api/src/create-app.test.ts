import { hashIp, ModelError, RateLimiterUnavailableError } from "@ai-in-learning/core/server";
import {
  FakeModelClient,
  MemoryRateLimiter,
  testRunner,
} from "@ai-in-learning/core/server/testing";
import { ApiError, type ErrorCode } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { type App, BODY_LIMIT_BYTES, createApp } from "./create-app.js";
import { loadEnv } from "./env.js";
import { ApiFailure, ERROR_CATALOGUE } from "./http/errors.js";
import type { RequestLogLine } from "./http/logging.js";

const FAKE_KEY = "sk-ant-api03-FAKE-KEY-0123456789abcdef";

const VALID_ENV = {
  ANTHROPIC_API_KEY: FAKE_KEY,
  UPSTASH_REDIS_REST_URL: "https://fake-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "FAKE-UPSTASH-TOKEN-0123456789",
  QUIZ_SIGNING_SECRET: "FAKE-SIGNING-SECRET-0123456789abcdef",
};

interface Setup {
  readonly app: App;
  readonly lines: RequestLogLine[];
  /** Every log line as written, for checks on the raw text. */
  readonly logText: () => string;
}

function setup(source: Record<string, string | undefined> = VALID_ENV): Setup {
  const lines: RequestLogLine[] = [];
  const app = createApp({
    env: loadEnv(source),
    createServices: (env) => ({
      model: new FakeModelClient([]),
      rateLimiter: new MemoryRateLimiter(),
      runner: testRunner,
      signingSecret: env.QUIZ_SIGNING_SECRET,
    }),
    log: (line) => lines.push(line),
  });
  // Test routes, registered after the app's middleware like the real routes.
  app.post("/api/test/echo", async (c) => c.json({ length: (await c.req.text()).length }));
  return { app, lines, logText: () => lines.map((line) => JSON.stringify(line)).join("\n") };
}

/** Adds a route that throws `error`, and requests it. */
async function requestThrowing(context: Setup, error: unknown): Promise<Response> {
  context.app.get("/api/test/throw", () => {
    throw error;
  });
  return context.app.request("/api/test/throw");
}

async function expectApiError(response: Response, code: ErrorCode): Promise<ApiError> {
  expect(response.status).toBe(ERROR_CATALOGUE[code].status);
  const body = ApiError.parse(await response.json());
  expect(body.error.code).toBe(code);
  expect(body.error.message).toBe(ERROR_CATALOGUE[code].message);
  return body;
}

function postBody(size: number): RequestInit {
  return { method: "POST", body: "x".repeat(size), headers: { "content-type": "text/plain" } };
}

describe("body limit", () => {
  it("rejects a body over 32 KB with invalid_request", async () => {
    const { app, lines } = setup();
    const response = await app.request("/api/test/echo", postBody(BODY_LIMIT_BYTES + 1));

    await expectApiError(response, "invalid_request");
    expect(lines).toMatchObject([{ status: 400, outcome: "invalid_request" }]);
  });

  it("rejects an oversized body sent without a content length", async () => {
    const { app } = setup();
    const chunk = new TextEncoder().encode("x".repeat(1024));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > BODY_LIMIT_BYTES) {
          controller.close();
          return;
        }
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const request = new Request("http://localhost/api/test/echo", {
      method: "POST",
      body,
      duplex: "half",
    });
    expect(request.headers.has("content-length")).toBe(false);

    await expectApiError(await app.request(request), "invalid_request");
  });

  it("lets a body of exactly 32 KB through", async () => {
    const { app } = setup();
    const response = await app.request("/api/test/echo", postBody(BODY_LIMIT_BYTES));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ length: BODY_LIMIT_BYTES });
  });
});

describe("error handling", () => {
  it("returns only the catalogue message for an error carrying a key and a stack", async () => {
    const context = setup();
    const error = new Error(`401 {"type":"authentication_error","x-api-key":"${FAKE_KEY}"}`);
    expect(error.stack).toContain("app.test.ts");

    const response = await requestThrowing(context, error);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: { code: "internal", message: ERROR_CATALOGUE.internal.message },
    });
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain("app.test.ts");
    expect(context.lines).toMatchObject([{ status: 500, outcome: "internal", error: "Error" }]);
    expect(context.logText()).not.toContain(FAKE_KEY);
    expect(context.logText()).not.toContain("app.test.ts");
  });

  it.each([
    ["ai_unavailable", 503],
    ["budget_exhausted", 503],
    ["internal", 500],
  ] as const)("keeps the code of a ModelError (%s)", async (code, status) => {
    const context = setup();
    const response = await requestThrowing(
      context,
      new ModelError(code, { status: 529, requestId: "req_fake" }),
    );

    expect(response.status).toBe(status);
    await expectApiError(response, code);
    expect(context.lines).toMatchObject([
      { outcome: code, error: "ModelError", upstreamStatus: 529, upstreamRequestId: "req_fake" },
    ]);
  });

  it("maps an unreachable rate-limit store to ai_unavailable", async () => {
    const response = await requestThrowing(setup(), new RateLimiterUnavailableError());
    await expectApiError(response, "ai_unavailable");
  });

  it("sends Retry-After and retryAfterSeconds for rate_limited", async () => {
    const response = await requestThrowing(
      setup(),
      new ApiFailure("rate_limited", { retryAfterSeconds: 1200 }),
    );

    const body = await expectApiError(response, "rate_limited");
    expect(response.headers.get("retry-after")).toBe("1200");
    expect(body.error.retryAfterSeconds).toBe(1200);
  });

  it("answers an unknown route with a 404 and the invalid_request body", async () => {
    const { app, lines } = setup();
    const response = await app.request("/api/quiz/unknown", { method: "POST" });

    expect(response.status).toBe(404);
    expect(ApiError.parse(await response.json()).error.code).toBe("invalid_request");
    expect(lines).toMatchObject([{ status: 404, outcome: "invalid_request" }]);
  });
});

describe("environment", () => {
  it("returns internal and logs the missing variable's name without any value", async () => {
    const context = setup({ ...VALID_ENV, UPSTASH_REDIS_REST_TOKEN: undefined });
    const response = await context.app.request("/api/test/echo", postBody(10));

    await expectApiError(response, "internal");
    expect(context.lines).toMatchObject([
      { status: 500, outcome: "internal", invalidVariables: ["UPSTASH_REDIS_REST_TOKEN"] },
    ]);
    for (const value of Object.values(VALID_ENV)) {
      expect(context.logText()).not.toContain(value);
    }
  });

  it("names a malformed variable without logging its value", async () => {
    const context = setup({ ...VALID_ENV, UPSTASH_REDIS_REST_URL: "http://plain-http.example" });
    await expectApiError(await context.app.request("/api/quiz/unknown"), "internal");

    expect(context.lines[0]?.invalidVariables).toEqual(["UPSTASH_REDIS_REST_URL"]);
    expect(context.logText()).not.toContain("plain-http.example");
  });

  it("fails every request, not only the first one", async () => {
    const { app, lines } = setup({});
    await expectApiError(await app.request("/api/test/echo", postBody(10)), "internal");
    await expectApiError(await app.request("/api/test/echo", postBody(10)), "internal");

    expect(lines).toHaveLength(2);
    expect(lines[1]?.invalidVariables).toEqual([
      "ANTHROPIC_API_KEY",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "QUIZ_SIGNING_SECRET",
    ]);
  });

  it("builds the production services from a valid environment without calling them", async () => {
    const lines: RequestLogLine[] = [];
    const app = createApp({ env: loadEnv(VALID_ENV), log: (line) => lines.push(line) });

    expect((await app.request("/api/quiz/unknown")).status).toBe(404);
    expect(lines).toMatchObject([{ outcome: "invalid_request" }]);
  });
});

describe("request log", () => {
  it("writes one line per request with the IP hash and never the raw IP", async () => {
    const { app, lines, logText } = setup();
    const ip = "203.0.113.42";
    const response = await app.request("/api/test/echo?ip=ignored", {
      ...postBody(10),
      headers: { "x-forwarded-for": `${ip}, 10.0.0.1, 10.0.0.2` },
    });

    expect(response.status).toBe(200);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      method: "POST",
      path: "/api/test/echo",
      status: 200,
      outcome: "ok",
      ipHash: await hashIp(ip),
    });
    expect(lines[0]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(logText()).not.toContain(ip);
    expect(logText()).not.toContain("10.0.0.1");
  });

  it("never logs a raw IPv6 address, whatever its case", async () => {
    const { app, logText } = setup();
    const ip = "2001:DB8::1";
    await app.request("/api/test/echo", { ...postBody(10), headers: { "x-forwarded-for": ip } });

    expect(logText().toLowerCase()).not.toContain(ip.toLowerCase());
  });

  it("logs a null IP hash when x-forwarded-for is missing", async () => {
    const { app, lines } = setup();
    await app.request("/api/test/echo", postBody(10));

    expect(lines[0]?.ipHash).toBeNull();
  });
});

describe("security headers", () => {
  it.each([
    ["a success", "/api/test/echo", postBody(10)],
    ["an error", "/api/quiz/unknown", { method: "POST" }],
  ] as const)("are set on %s", async (_label, path, init) => {
    const response = await setup().app.request(path, init);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
  });
});
