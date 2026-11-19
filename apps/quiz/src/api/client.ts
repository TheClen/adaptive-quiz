import {
  ApiError,
  type CodeReviewRequest,
  CodeReviewResponse,
  type ErrorCode,
  type NextQuestionRequest,
  NextQuestionResponse,
} from "@ai-in-learning/shared-types";

/**
 * Time after which a request is abandoned: just above the API function's
 * `maxDuration` of 60 s (plan §13.1).
 */
export const REQUEST_TIMEOUT_MS = 65_000;

export interface RequestOptions {
  /** Aborting it cancels the request; the promise then rejects with the abort reason. */
  readonly signal?: AbortSignal;
}

/**
 * The quiz API as the front-end sees it. Injected through React context, so
 * component tests pass a fake (plan §13.1).
 *
 * Every method resolves with a response that parsed with its `shared-types`
 * schema, or rejects with an {@link ApiClientError}. The one exception is a
 * request aborted through its `signal`, which rejects with the abort reason.
 */
export interface ApiClient {
  nextQuestion(
    request: NextQuestionRequest,
    options?: RequestOptions,
  ): Promise<NextQuestionResponse>;
  codeReview(request: CodeReviewRequest, options?: RequestOptions): Promise<CodeReviewResponse>;
}

/** Why a request failed, as the screens need it: a catalogue code, never upstream text. */
export interface RequestFailure {
  readonly code: ErrorCode;
  /** For `rate_limited`: when the visitor can try again (AC-8.2). */
  readonly retryAfterSeconds?: number;
}

/** A failed API request. It carries a catalogue code only (AC-8.4). */
export class ApiClientError extends Error {
  override readonly name = "ApiClientError";
  readonly failure: RequestFailure;

  constructor(failure: RequestFailure, options: { readonly cause?: unknown } = {}) {
    super(`API request failed: ${failure.code}`, options);
    this.failure = failure;
  }
}

/** The failure to show for anything an {@link ApiClient} rejected with. */
export function toRequestFailure(error: unknown): RequestFailure {
  return error instanceof ApiClientError ? error.failure : { code: "internal" };
}

/** The part of a Zod schema the client needs. */
interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export interface FetchApiClientOptions {
  /** Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Prefix of every path. Defaults to `""`: the API is on the same origin (plan §14). */
  readonly baseUrl?: string;
  /** Defaults to {@link REQUEST_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
}

/**
 * The {@link ApiClient} that calls the API with `fetch`.
 *
 * - A response that does not parse with its schema is `internal` (plan §13.1).
 * - An error response keeps its code when its body is an `ApiError`, and is
 *   `internal` otherwise. Its message is dropped: screens show their own.
 * - A request still pending after the timeout is aborted and is `ai_unavailable`:
 *   the AI is too slow (AC-8.1). Any other network failure is `internal`.
 */
export function createFetchApiClient(options: FetchApiClientOptions = {}): ApiClient {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? "";
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  async function post<T>(
    path: string,
    body: unknown,
    schema: ResponseSchema<T>,
    requestOptions: RequestOptions,
  ): Promise<T> {
    const callerSignal = requestOptions.signal;
    callerSignal?.throwIfAborted();

    // Aborted by the caller's signal or by the timeout, nothing else.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const abortFromCaller = (): void => {
      controller.abort(callerSignal?.reason);
    };
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

    let response: Response;
    let payload: unknown;
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      payload = await readJson(response);
    } catch (error) {
      if (callerSignal?.aborted === true) {
        throw callerSignal.reason;
      }
      const timedOut = controller.signal.aborted;
      throw new ApiClientError(
        { code: timedOut ? "ai_unavailable" : "internal" },
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }

    if (!response.ok) {
      throw new ApiClientError(failureFrom(payload));
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError({ code: "internal" });
    }
    return parsed.data;
  }

  return {
    nextQuestion: (request, requestOptions = {}) =>
      post("/api/quiz/next-question", request, NextQuestionResponse, requestOptions),
    codeReview: (request, requestOptions = {}) =>
      post("/api/quiz/code-review", request, CodeReviewResponse, requestOptions),
  };
}

/**
 * The body as JSON, or `undefined` when it is not JSON. Network errors and aborts
 * while reading still throw.
 */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** The failure an error body describes, or `internal` when it is not an `ApiError`. */
function failureFrom(payload: unknown): RequestFailure {
  const parsed = ApiError.safeParse(payload);
  if (!parsed.success) {
    return { code: "internal" };
  }
  const { code, retryAfterSeconds } = parsed.data.error;
  return retryAfterSeconds === undefined ? { code } : { code, retryAfterSeconds };
}
