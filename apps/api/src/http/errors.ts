import { ModelError, RateLimiterUnavailableError } from "@ai-in-learning/core/server";
import type { ApiError, ErrorCode } from "@ai-in-learning/shared-types";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

interface CatalogueEntry {
  readonly status: ContentfulStatusCode;
  readonly message: string;
}

/**
 * The error catalogue of plan §7.3: one HTTP status and one fixed message per
 * code. Responses carry only these messages, never upstream details (AC-8.4).
 * The front-end shows its own wording for each code.
 */
export const ERROR_CATALOGUE: Readonly<Record<ErrorCode, CatalogueEntry>> = {
  invalid_request: { status: 400, message: "The request is invalid." },
  rate_limited: { status: 429, message: "Too many requests. Try again later." },
  budget_exhausted: { status: 503, message: "The demo is temporarily unavailable." },
  ai_unavailable: { status: 503, message: "The AI service is not responding." },
  generation_failed: { status: 502, message: "The question could not be generated." },
  internal: { status: 500, message: "Something went wrong." },
};

/**
 * A request that ends with a catalogue error. Routes throw it, and `onError`
 * turns it into the response. Its message is the catalogue's.
 */
export class ApiFailure extends Error {
  override readonly name = "ApiFailure";
  readonly code: ErrorCode;
  /** For `rate_limited`: sent as `Retry-After` and in the body (AC-8.2). */
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ErrorCode, options: { readonly retryAfterSeconds?: number } = {}) {
    super(ERROR_CATALOGUE[code].message);
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/**
 * Maps anything thrown while handling a request to a catalogue code. Errors from
 * `core/server` keep their code; anything else is `internal`.
 */
export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) {
    return error;
  }
  if (error instanceof ModelError) {
    return new ApiFailure(error.code);
  }
  if (error instanceof RateLimiterUnavailableError) {
    return new ApiFailure("ai_unavailable");
  }
  if (error instanceof HTTPException && error.status < 500) {
    return new ApiFailure("invalid_request");
  }
  return new ApiFailure("internal");
}

/** The response for a failure: the `ApiError` body, plus `Retry-After` when set. */
export function errorResponse(
  c: Context,
  failure: ApiFailure,
  status: ContentfulStatusCode = ERROR_CATALOGUE[failure.code].status,
): Response {
  const { retryAfterSeconds } = failure;
  const body: ApiError = {
    error: {
      code: failure.code,
      message: ERROR_CATALOGUE[failure.code].message,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
  };
  if (retryAfterSeconds !== undefined) {
    c.header("Retry-After", String(retryAfterSeconds));
  }
  return c.json(body, status);
}
