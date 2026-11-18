import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { ModelError, mapModelError, type ModelErrorCode } from "./model-errors.js";
import { REQUEST_ID, UPSTREAM_DETAIL, errorResponse } from "./testing/sdk-responses.js";

/** Calls the real SDK with a fake `fetch` and returns the error it throws. */
async function sdkError(
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  requestOptions: { timeout?: number } = {},
): Promise<unknown> {
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, logLevel: "off", fetch });
  try {
    await sdk.messages.create(
      {
        model: "claude-haiku-5-5",
        max_tokens: 16,
        messages: [{ role: "user", content: "Hello" }],
      },
      requestOptions,
    );
  } catch (error) {
    return error;
  }
  throw new Error("Expected the SDK call to fail");
}

function respond(response: () => Response) {
  return () => Promise.resolve(response());
}

/** Never answers, and rejects when the SDK aborts the request on timeout. */
function hang(_input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });
}

function refuse(): Promise<Response> {
  return Promise.reject(new TypeError(`fetch failed: ${UPSTREAM_DETAIL}`));
}

const detail = ` ${UPSTREAM_DETAIL}`;

const cases: {
  name: string;
  error: () => Promise<unknown>;
  code: ModelErrorCode;
  status: number | null;
}[] = [
  {
    name: "timeout",
    error: () => sdkError(hang, { timeout: 5 }),
    code: "ai_unavailable",
    status: null,
  },
  { name: "connection error", error: () => sdkError(refuse), code: "ai_unavailable", status: null },
  {
    name: "429 rate limit",
    error: () =>
      sdkError(respond(() => errorResponse(429, "rate_limit_error", `Rate limited.${detail}`))),
    code: "ai_unavailable",
    status: 429,
  },
  {
    name: "429 ramp limit",
    error: () =>
      sdkError(
        respond(() =>
          errorResponse(429, "rate_limit_error", `Ramp limit.${detail}`, {
            errorCode: "ramp_limit_exceeded",
          }),
        ),
      ),
    code: "ai_unavailable",
    status: 429,
  },
  {
    name: "500 api error",
    error: () =>
      sdkError(respond(() => errorResponse(500, "api_error", `Internal error.${detail}`))),
    code: "ai_unavailable",
    status: 500,
  },
  {
    name: "529 overloaded",
    error: () =>
      sdkError(respond(() => errorResponse(529, "overloaded_error", `Overloaded.${detail}`))),
    code: "ai_unavailable",
    status: 529,
  },
  {
    name: "402 billing error",
    error: () =>
      sdkError(respond(() => errorResponse(402, "billing_error", `Billing problem.${detail}`))),
    code: "budget_exhausted",
    status: 402,
  },
  {
    name: "429 tier spend cap",
    error: () =>
      sdkError(
        respond(() =>
          errorResponse(429, "rate_limit_error", `Spend cap reached.${detail}`, {
            errorCode: "enforced_spend_limit_reached",
          }),
        ),
      ),
    code: "budget_exhausted",
    status: 429,
  },
  {
    name: "400 workspace spend limit",
    error: () =>
      sdkError(
        respond(() =>
          errorResponse(
            400,
            "invalid_request_error",
            `You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.${detail}`,
          ),
        ),
      ),
    code: "budget_exhausted",
    status: 400,
  },
  {
    name: "400 organization spend limit",
    error: () =>
      sdkError(
        respond(() =>
          errorResponse(
            400,
            "invalid_request_error",
            `You have reached your specified API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.${detail}`,
          ),
        ),
      ),
    code: "budget_exhausted",
    status: 400,
  },
  {
    name: "400 invalid request",
    error: () =>
      sdkError(
        respond(() =>
          errorResponse(400, "invalid_request_error", `max_tokens: too large.${detail}`),
        ),
      ),
    code: "internal",
    status: 400,
  },
  {
    name: "401 authentication",
    error: () =>
      sdkError(respond(() => errorResponse(401, "authentication_error", `Invalid key.${detail}`))),
    code: "internal",
    status: 401,
  },
  {
    name: "403 permission",
    error: () =>
      sdkError(respond(() => errorResponse(403, "permission_error", `Forbidden.${detail}`))),
    code: "internal",
    status: 403,
  },
  {
    name: "404 not found",
    error: () =>
      sdkError(respond(() => errorResponse(404, "not_found_error", `model: unknown.${detail}`))),
    code: "internal",
    status: 404,
  },
  {
    name: "error outside the SDK",
    error: () => Promise.resolve(new TypeError(`Cannot read properties of undefined.${detail}`)),
    code: "internal",
    status: null,
  },
  {
    name: "thrown string",
    error: () => Promise.resolve(`boom${detail}`),
    code: "internal",
    status: null,
  },
];

describe("mapModelError", () => {
  it.each(cases)("maps $name to $code", async ({ error, code, status }) => {
    const mapped = mapModelError(await error());

    expect(mapped).toBeInstanceOf(ModelError);
    expect(mapped.code).toBe(code);
    expect(mapped.status).toBe(status);
    expect(mapped.requestId).toBe(status === null ? null : REQUEST_ID);
  });

  it.each(cases)(
    "keeps no upstream detail when mapping $name (AC-8.4)",
    async ({ name, error }) => {
      const original = await error();
      if (original instanceof Error && name !== "timeout") {
        // Guards the test itself: the upstream error does carry the detail.
        expect(`${original.message} ${String(original.cause)}`).toContain("UPSTREAM-DETAIL");
      }

      const mapped = mapModelError(original);

      expect(mapped.message).not.toContain("UPSTREAM-DETAIL");
      expect(mapped.stack ?? "").not.toContain("UPSTREAM-DETAIL");
      expect(JSON.stringify(mapped)).not.toContain("UPSTREAM-DETAIL");
      expect(mapped.cause).toBeUndefined();
    },
  );

  it("returns a ModelError unchanged", () => {
    const error = new ModelError("budget_exhausted", { status: 402 });

    expect(mapModelError(error)).toBe(error);
  });
});
