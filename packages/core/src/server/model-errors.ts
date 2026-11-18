import Anthropic, { APIConnectionError, APIError } from "@anthropic-ai/sdk";
import type { ErrorCode } from "@ai-in-learning/shared-types";

/** The catalogue codes an upstream model failure can map to (plan §11.3). */
export type ModelErrorCode = Extract<ErrorCode, "ai_unavailable" | "budget_exhausted" | "internal">;

const MESSAGES: Record<ModelErrorCode, string> = {
  ai_unavailable: "The model service did not respond.",
  budget_exhausted: "The model spend limit is reached.",
  internal: "The model call failed.",
};

/**
 * A model failure with a fixed message. It keeps the HTTP status and the request
 * id for the server log, never the upstream message or the original error, so
 * nothing upstream can leak into a response or a log line (AC-8.4).
 */
export class ModelError extends Error {
  override readonly name = "ModelError";
  readonly code: ModelErrorCode;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(
    code: ModelErrorCode,
    upstream: { status?: number | undefined; requestId?: string | null | undefined } = {},
  ) {
    super(MESSAGES[code]);
    this.code = code;
    this.status = upstream.status ?? null;
    this.requestId = upstream.requestId ?? null;
  }
}

/**
 * The 400 Anthropic returns when usage reaches a spend limit set in the Console:
 * "You have reached your specified API usage limits" for the organization, and
 * "You have reached your specified workspace API usage limits" for a workspace.
 * The response has no `error_code`, so the message prefix is the only signal.
 * Source: https://platform.claude.com/docs/en/api/rate-limits#setting-your-own-spend-limit
 */
const SPEND_LIMIT_MESSAGE = /^You have reached your specified (?:workspace )?API usage limits/;

function isSpendLimit(error: APIError): boolean {
  return (
    // The usage tier's monthly spend cap: 429 with `enforced_spend_limit_reached`.
    error instanceof Anthropic.EnforcedSpendLimitReachedError ||
    error.status === 402 ||
    error.type === "billing_error" ||
    (error.status === 400 && SPEND_LIMIT_MESSAGE.test(error.apiMessage ?? ""))
  );
}

/** `instanceof` alone narrows to `APIError<any, any, any>`; this keeps the declared types. */
function isApiError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/** Maps any error thrown by a model call to a `ModelError` (plan §11.3). */
export function mapModelError(error: unknown): ModelError {
  if (error instanceof ModelError) {
    return error;
  }
  // `APIConnectionError` (and its timeout subclass) extends `APIError`, so it goes first.
  if (error instanceof APIConnectionError) {
    return new ModelError("ai_unavailable");
  }
  if (isApiError(error)) {
    const upstream = { status: error.status, requestId: error.requestID };
    if (isSpendLimit(error)) {
      return new ModelError("budget_exhausted", upstream);
    }
    if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
      return new ModelError("ai_unavailable", upstream);
    }
    return new ModelError("internal", upstream);
  }
  return new ModelError("internal");
}
