import { type CodeReviewRequest, CodeReviewResponse } from "@ai-in-learning/shared-types";

import { findConcept } from "../../catalogue.js";
import type { Runner } from "../../runner/index.js";
import { verifyExercise } from "../exercise-token.js";
import type { ModelClient, ModelOutputFailure, ModelUsage } from "../model-client.js";
import { buildReviewPrompt } from "../prompts/index.js";
import { CodeReviewDraft } from "./draft.js";

/** One model call per review (NFR-3): no retry on invalid output (plan §10). */
export const MAX_REVIEW_ATTEMPTS = 1;

/** What `reviewCode` needs from the server. */
export interface ReviewContext {
  readonly model: ModelClient;
  /**
   * Re-runs the tests on the visitor's code (plan §7.2): a runner created with
   * `RUN_TIMEOUT_MS.server`.
   */
  readonly runner: Runner;
  /** `QUIZ_SIGNING_SECRET`, the key that verifies `exerciseToken` (plan §7.2). */
  readonly signingSecret: string;
}

/** The model call of a review, for the request log (plan §11.4). */
export interface ReviewAttempt {
  readonly model: string;
  readonly usage: ModelUsage;
  /** Why the output was rejected, or `null` for the accepted review. */
  readonly rejection: ModelOutputFailure | null;
}

export type ReviewResult =
  | {
      readonly ok: true;
      readonly response: CodeReviewResponse;
      readonly attempts: readonly ReviewAttempt[];
    }
  | {
      /**
       * The exercise is not the one the server generated: its token does not verify,
       * or its concept is not one of the topic. The model is never called.
       */
      readonly ok: false;
      readonly code: "invalid_request";
      readonly attempts: readonly [];
    }
  | {
      /** The model output was unusable. The front-end offers a retry (plan §10). */
      readonly ok: false;
      readonly code: "generation_failed";
      readonly attempts: readonly ReviewAttempt[];
    };

const INVALID_REQUEST = { ok: false, code: "invalid_request", attempts: [] } as const;

/**
 * Reviews a submitted code exercise (plan §7.2, §10):
 *
 * 1. Verifies `exerciseToken`, so the exercise, its tests and its reference solution
 *    are the server's own. Anything else is `invalid_request`, before any run or
 *    model call.
 * 2. Re-runs the tests on the visitor's code in the QuickJS runner. The prompt carries
 *    these results only: the client never reports its own.
 * 3. Builds the prompt, with the verdict stated as a fact the review must not
 *    contradict (AC-6.3), and makes exactly one model call (NFR-3).
 * 4. Checks the output against `CodeReview`: a summary and 1 to 5 comments, within
 *    their lengths. The review has no verdict field, so only the tests decide whether
 *    the code is correct (AC-6.3).
 *
 * The request must have passed `CodeReviewRequest`. Upstream failures are thrown as
 * `ModelError`, without a retry: the SDK already retried transient errors.
 */
export async function reviewCode(
  context: ReviewContext,
  request: CodeReviewRequest,
): Promise<ReviewResult> {
  const { topic, conceptId, level, exercise, code } = request;
  if (!(await verifyExercise(context.signingSecret, exercise))) return INVALID_REQUEST;
  const concept = findConcept(topic, conceptId);
  if (concept === undefined) return INVALID_REQUEST;

  const results = await context.runner.run({
    code,
    functionName: exercise.functionName,
    tests: exercise.tests,
  });
  const prompt = buildReviewPrompt({ topic, concept, level, exercise, code, results });
  const result = await context.model.generate({
    route: "review",
    system: prompt.system,
    messages: prompt.messages,
    schema: CodeReviewDraft,
  });

  const { model, usage } = result;
  if (!result.ok) {
    return {
      ok: false,
      code: "generation_failed",
      attempts: [{ model, usage, rejection: result.reason }],
    };
  }
  // Lengths and the comment count, which the output schema does not express. Parsing
  // also drops any field the review schema does not know.
  const parsed = CodeReviewResponse.safeParse({ review: result.output });
  if (!parsed.success) {
    return {
      ok: false,
      code: "generation_failed",
      attempts: [{ model, usage, rejection: "invalid_output" }],
    };
  }
  return { ok: true, response: parsed.data, attempts: [{ model, usage, rejection: null }] };
}
