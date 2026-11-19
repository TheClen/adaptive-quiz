import type {
  CodeReviewRequest,
  CodeReviewResponse,
  NextQuestionRequest,
  NextQuestionResponse,
} from "@ai-in-learning/shared-types";

import type { ApiClient, RequestOptions } from "../api/client.js";

/** A request the fake received, settled by the test. */
export interface PendingCall<Request, Response> {
  readonly request: Request;
  readonly signal: AbortSignal | undefined;
  resolve(response: Response): void;
  reject(error: unknown): void;
}

export interface FakeApiClient {
  readonly client: ApiClient;
  /** Every `nextQuestion` call, in order. */
  readonly nextQuestionCalls: PendingCall<NextQuestionRequest, NextQuestionResponse>[];
  /** Every `codeReview` call, in order. */
  readonly codeReviewCalls: PendingCall<CodeReviewRequest, CodeReviewResponse>[];
}

/**
 * An {@link ApiClient} whose requests stay pending until the test settles them,
 * so tests can look at the loading state first.
 */
export function createFakeApiClient(): FakeApiClient {
  const nextQuestionCalls: PendingCall<NextQuestionRequest, NextQuestionResponse>[] = [];
  const codeReviewCalls: PendingCall<CodeReviewRequest, CodeReviewResponse>[] = [];

  function record<Request, Response>(
    calls: PendingCall<Request, Response>[],
    request: Request,
    options: RequestOptions | undefined,
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      calls.push({ request, signal: options?.signal, resolve, reject });
    });
  }

  return {
    client: {
      nextQuestion: (request, options) => record(nextQuestionCalls, request, options),
      codeReview: (request, options) => record(codeReviewCalls, request, options),
    },
    nextQuestionCalls,
    codeReviewCalls,
  };
}
