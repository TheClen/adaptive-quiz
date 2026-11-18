import { NextQuestionResponse, type SessionState } from "@ai-in-learning/shared-types";

import { levelHistory, START_LEVEL } from "../../adaptation.js";
import { kindAt, nextPosition } from "../../schedule.js";
import { selectNextConcept } from "../../selection.js";
import type { ModelClient, ModelOutputFailure, ModelUsage } from "../model-client.js";
import { buildQuestionPrompt, type QuestionRequest, type RetryReason } from "../prompts/index.js";
import { checkChoiceDraft } from "./choice-rules.js";
import { ChoiceDraft } from "./drafts.js";
import { shuffleRandom, toChoiceQuestion } from "./normalise.js";

/** One model call per attempt: the first draft, then at most one retry (plan §8.4, D4). */
export const MAX_GENERATION_ATTEMPTS = 2;

/** What `generateQuestion` needs from the server. */
export interface GenerationContext {
  readonly model: ModelClient;
}

/** One model call, for the request log (plan §11.4). */
export interface GenerationAttempt {
  readonly model: string;
  readonly usage: ModelUsage;
  /** Why the draft was rejected, or `null` for the accepted draft. */
  readonly rejection: RetryReason | null;
}

export type GenerationResult =
  | {
      readonly ok: true;
      readonly response: NextQuestionResponse;
      readonly attempts: readonly GenerationAttempt[];
    }
  | {
      readonly ok: false;
      readonly code: "generation_failed";
      readonly attempts: readonly GenerationAttempt[];
    };

const OUTPUT_FAILURES = {
  refusal: { rule: "refusal" },
  max_tokens: { rule: "max-tokens" },
  invalid_output: { rule: "invalid-output" },
} as const satisfies Record<ModelOutputFailure, RetryReason>;

/**
 * Generates the next question of a session (plan §8.4): derives its position, kind,
 * level and concept from the state, asks the model for a draft, checks it, and
 * retries once with the broken rule named. A rejected draft never leaves this
 * function. Two rejected drafts give `generation_failed` (AC-8.1).
 *
 * The level comes from the answers only, whatever the model returns (AC-4.5).
 *
 * The state must have passed `checkSessionState`. Upstream failures are thrown as
 * `ModelError`, without a retry: the SDK already retried transient errors.
 */
export async function generateQuestion(
  context: GenerationContext,
  state: Pick<SessionState, "topic" | "seed" | "answers">,
): Promise<GenerationResult> {
  const { topic, seed, answers } = state;
  const position = nextPosition(answers);
  const kind = kindAt(position);
  if (kind === "code") {
    // The code exercise path (static checks, solvability, token) is task 001/T12.
    throw new Error("Code exercise generation is not implemented yet");
  }
  const { concept, revisit } = selectNextConcept(topic, seed, answers);
  const level = levelHistory(answers).at(-1) ?? START_LEVEL;
  const request: QuestionRequest = { topic, kind, concept, level, revisit, answers };
  const previousStems = answers.map((answer) => answer.stem);

  const attempts: GenerationAttempt[] = [];
  let retry: RetryReason | undefined;
  while (attempts.length < MAX_GENERATION_ATTEMPTS) {
    const prompt = buildQuestionPrompt(request, retry);
    const result = await context.model.generate({
      route: "choice",
      system: prompt.system,
      messages: prompt.messages,
      schema: ChoiceDraft,
    });

    let rejection: RetryReason | null = result.ok
      ? checkChoiceDraft(kind, topic, result.output, previousStems)
      : OUTPUT_FAILURES[result.reason];
    let response: NextQuestionResponse | undefined;
    if (result.ok && rejection === null) {
      // The API schema checks the normalised question again (plan §8.4 step 1).
      const parsed = NextQuestionResponse.safeParse({
        position,
        level,
        conceptId: concept.id,
        conceptLabel: concept.label,
        question: toChoiceQuestion(kind, result.output, shuffleRandom(seed, position)),
      });
      if (parsed.success) {
        response = parsed.data;
      } else {
        rejection = OUTPUT_FAILURES.invalid_output;
      }
    }

    attempts.push({ model: result.model, usage: result.usage, rejection });
    if (response !== undefined) {
      return { ok: true, response, attempts };
    }
    retry = rejection ?? OUTPUT_FAILURES.invalid_output;
  }
  return { ok: false, code: "generation_failed", attempts };
}
