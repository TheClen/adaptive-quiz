import { checkSessionState } from "@ai-in-learning/core";
import {
  generateQuestion,
  type ModelUsage,
  reviewCode,
  verifyExercise,
} from "@ai-in-learning/core/server";
import { CodeReviewRequest, NextQuestionRequest } from "@ai-in-learning/shared-types";
import { Hono } from "hono";

import type { AppBindings } from "../create-app.js";
import { parseJsonBody } from "../http/body.js";
import { ApiFailure } from "../http/errors.js";
import type { RequestLogFields } from "../http/logging.js";
import { clientKey, enforceLimit, withGlobalCap } from "../http/rate-limits.js";

/** A model call as the request log sees it, for generation and review alike. */
interface LoggedAttempt {
  readonly model: string;
  readonly usage: ModelUsage;
  /** The rule the rejected output broke, or `null` for the accepted one. */
  readonly rejection: string | null;
}

function totalUsage(attempts: readonly LoggedAttempt[]): ModelUsage {
  return attempts.reduce<ModelUsage>(
    (total, { usage }) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
      cacheReadInputTokens: total.cacheReadInputTokens + usage.cacheReadInputTokens,
      cacheCreationInputTokens: total.cacheCreationInputTokens + usage.cacheCreationInputTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
  );
}

/**
 * The rule a rejected draft broke, with its details, for example
 * `field-too-long:code` or `near-duplicate:2`. Retry reasons carry only enums and
 * numbers (plan §8.3), so the label holds nothing the model or the client wrote.
 */
function rejectionLabel({ rule, ...details }: { readonly rule: string }): string {
  return [rule, ...Object.values(details).map(String)].join(":");
}

/** Model, token usage and rejected rules, never drafts, prompts or code (plan §11.4). */
function logAttempts(log: RequestLogFields, attempts: readonly LoggedAttempt[]): void {
  const last = attempts.at(-1);
  if (last !== undefined) {
    log.model = last.model;
  }
  log.attempts = attempts.length;
  log.usage = totalUsage(attempts);
  log.rejections = attempts.flatMap(({ rejection }) => (rejection === null ? [] : [rejection]));
}

/** The quiz routes, mounted at `/api/quiz` (plan §7). */
export function quizRoutes(): Hono<AppBindings> {
  const routes = new Hono<AppBindings>();

  /**
   * `POST /api/quiz/next-question` (plan §7.1, §12). Checks run cheapest first, and
   * nothing reaches the model before every check has passed:
   *
   * 1. the body and the session state (`invalid_request`);
   * 2. `sessions` for a new session, then `questions`: a refused `sessions` check
   *    is not counted, so a visitor who keeps starting sessions past the limit does
   *    not use up their questions;
   * 3. `global`, before each model call (in `withGlobalCap`).
   */
  routes.post("/next-question", async (c) => {
    const { services, log } = c.var;
    const { state } = await parseJsonBody(c, NextQuestionRequest);
    if (!checkSessionState(state).ok) {
      throw new ApiFailure("invalid_request");
    }

    const ipHash = await clientKey(c.var.ipHash);
    if (state.answers.length === 0) {
      await enforceLimit(services.rateLimiter, { limit: "sessions", ipHash });
    }
    await enforceLimit(services.rateLimiter, { limit: "questions", ipHash });

    const model = withGlobalCap(services.model, services.rateLimiter, () => {
      log.attempts = (log.attempts ?? 0) + 1;
    });
    const result = await generateQuestion(
      { model, runner: services.runner, signingSecret: services.signingSecret },
      state,
    );
    logAttempts(
      log,
      result.attempts.map((attempt) => ({
        ...attempt,
        rejection: attempt.rejection === null ? null : rejectionLabel(attempt.rejection),
      })),
    );
    if (!result.ok) {
      throw new ApiFailure(result.code);
    }
    return c.json(result.response, 200);
  });

  /**
   * `POST /api/quiz/code-review` (plan §7.2, §10). Checks run cheapest first, as
   * above, and nothing runs the visitor's code or reaches the model before they pass:
   *
   * 1. the body and the exercise token (`invalid_request`): an exercise the server
   *    did not generate is refused before it counts against any limit;
   * 2. `reviews`;
   * 3. `global`, before the one model call (in `withGlobalCap`).
   *
   * `reviewCode` verifies the token again, so it stays safe on its own; an HMAC is
   * cheap next to a QuickJS run and a model call.
   */
  routes.post("/code-review", async (c) => {
    const { services, log } = c.var;
    const request = await parseJsonBody(c, CodeReviewRequest);
    if (!(await verifyExercise(services.signingSecret, request.exercise))) {
      throw new ApiFailure("invalid_request");
    }

    const ipHash = await clientKey(c.var.ipHash);
    await enforceLimit(services.rateLimiter, { limit: "reviews", ipHash });

    const model = withGlobalCap(services.model, services.rateLimiter, () => {
      log.attempts = (log.attempts ?? 0) + 1;
    });
    const result = await reviewCode(
      { model, runner: services.runner, signingSecret: services.signingSecret },
      request,
    );
    logAttempts(log, result.attempts);
    if (!result.ok) {
      throw new ApiFailure(result.code);
    }
    return c.json(result.response, 200);
  });

  return routes;
}
