import {
  type Level,
  NextQuestionResponse,
  type Position,
  type Question,
  type SessionState,
  type TopicId,
} from "@ai-in-learning/shared-types";
import type { z } from "zod";

import { levelHistory, START_LEVEL } from "../../adaptation.js";
import type { Concept } from "../../catalogue.js";
import type { Runner } from "../../runner/index.js";
import { kindAt, nextPosition } from "../../schedule.js";
import { selectNextConcept } from "../../selection.js";
import { signExercise } from "../exercise-token.js";
import type { ModelClient, ModelOutputFailure, ModelUsage } from "../model-client.js";
import type { ModelRoute } from "../model-config.js";
import { buildQuestionPrompt, type QuestionRequest, type RetryReason } from "../prompts/index.js";
import { type ChoiceKind, checkChoiceDraft } from "./choice-rules.js";
import { checkCodeDraft, checkCodeRuns } from "./code-rules.js";
import { ChoiceDraft, CodeExerciseDraft } from "./drafts.js";
import { shuffleRandom, toChoiceQuestion } from "./normalise.js";

/** One model call per attempt: the first draft, then at most one retry (plan §8.4, D4). */
export const MAX_GENERATION_ATTEMPTS = 2;

/** What `generateQuestion` needs from the server. */
export interface GenerationContext {
  readonly model: ModelClient;
  /**
   * Runs reference solutions and starter code (plan §9.2): a runner created with
   * `RUN_TIMEOUT_MS.server`.
   */
  readonly runner: Runner;
  /** `QUIZ_SIGNING_SECRET`, the key of `exerciseToken` (plan §7.2). */
  readonly signingSecret: string;
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

/** A checked draft turned into a question, or the first rule it breaks. */
type Accepted =
  | { readonly ok: true; readonly question: Question }
  | { readonly ok: false; readonly reason: RetryReason };

/** The part of the pipeline that depends on the kind: route, draft schema, checks. */
interface DraftPipeline<T> {
  readonly route: ModelRoute;
  readonly schema: z.ZodType<T>;
  accept(draft: T): Promise<Accepted>;
}

/** What the response says about the question, derived from the state only (AC-4.5). */
interface QuestionFrame {
  readonly position: Position;
  readonly level: Level;
  readonly concept: Concept;
}

/** Choice questions: domain rules, then the option shuffle (plan §8.4 steps 2 and 4). */
function choicePipeline(
  kind: ChoiceKind,
  topic: TopicId,
  seed: number,
  position: Position,
  previousStems: readonly string[],
): DraftPipeline<ChoiceDraft> {
  return {
    route: "choice",
    schema: ChoiceDraft,
    accept(draft) {
      const reason = checkChoiceDraft(kind, topic, draft, previousStems);
      return Promise.resolve(
        reason === null
          ? { ok: true, question: toChoiceQuestion(kind, draft, shuffleRandom(seed, position)) }
          : { ok: false, reason },
      );
    },
  };
}

/**
 * Code exercises: static checks and test JSON, then the reference solution and the
 * starter code in the runner, then the signature (plan §8.4 steps 2 to 4, §9.3).
 */
function codePipeline(
  context: GenerationContext,
  previousStems: readonly string[],
): DraftPipeline<CodeExerciseDraft> {
  return {
    route: "code",
    schema: CodeExerciseDraft,
    async accept(draft) {
      const checked = checkCodeDraft(draft, previousStems);
      if (!checked.ok) return checked;
      const reason = await checkCodeRuns(context.runner, draft, checked.tests);
      if (reason !== null) return { ok: false, reason };
      const question = await signExercise(context.signingSecret, {
        kind: "code",
        prompt: draft.prompt,
        functionName: draft.functionName,
        starterCode: draft.starterCode,
        tests: checked.tests,
        referenceSolution: draft.referenceSolution,
        explanation: draft.explanation,
      });
      return { ok: true, question };
    },
  };
}

/** The draft, check and retry loop shared by every kind (plan §8.4, D4). */
async function runPipeline<T>(
  model: ModelClient,
  request: QuestionRequest,
  frame: QuestionFrame,
  pipeline: DraftPipeline<T>,
): Promise<GenerationResult> {
  const attempts: GenerationAttempt[] = [];
  let retry: RetryReason | undefined;
  while (attempts.length < MAX_GENERATION_ATTEMPTS) {
    const prompt = buildQuestionPrompt(request, retry);
    const result = await model.generate({
      route: pipeline.route,
      system: prompt.system,
      messages: prompt.messages,
      schema: pipeline.schema,
    });

    let rejection: RetryReason;
    let response: NextQuestionResponse | undefined;
    if (result.ok) {
      const accepted = await pipeline.accept(result.output);
      if (accepted.ok) {
        // The API schema checks the normalised question again (plan §8.4 step 1).
        const parsed = NextQuestionResponse.safeParse({
          position: frame.position,
          level: frame.level,
          conceptId: frame.concept.id,
          conceptLabel: frame.concept.label,
          question: accepted.question,
        });
        if (parsed.success) response = parsed.data;
        rejection = OUTPUT_FAILURES.invalid_output;
      } else {
        rejection = accepted.reason;
      }
    } else {
      rejection = OUTPUT_FAILURES[result.reason];
    }

    if (response !== undefined) {
      attempts.push({ model: result.model, usage: result.usage, rejection: null });
      return { ok: true, response, attempts };
    }
    attempts.push({ model: result.model, usage: result.usage, rejection });
    retry = rejection;
  }
  return { ok: false, code: "generation_failed", attempts };
}

/**
 * Generates the next question of a session (plan §8.4): derives its position, kind,
 * level and concept from the state, asks the model for a draft, checks it, and
 * retries once with the broken rule named. A rejected draft never leaves this
 * function. Two rejected drafts give `generation_failed` (AC-8.1).
 *
 * A code exercise is returned only once its reference solution passes every test
 * and its starter code fails at least one, both in the QuickJS runner (AC-3.6), and
 * it carries its `exerciseToken`.
 *
 * The level comes from the answers only, whatever the model returns (AC-4.5).
 *
 * The state must have passed `checkSessionState`. Upstream failures are thrown as
 * `ModelError`, without a retry: the SDK already retried transient errors.
 */
export function generateQuestion(
  context: GenerationContext,
  state: Pick<SessionState, "topic" | "seed" | "answers">,
): Promise<GenerationResult> {
  const { topic, seed, answers } = state;
  const position = nextPosition(answers);
  const kind = kindAt(position);
  const { concept, revisit } = selectNextConcept(topic, seed, answers);
  const level = levelHistory(answers).at(-1) ?? START_LEVEL;
  const request: QuestionRequest = { topic, kind, concept, level, revisit, answers };
  const frame: QuestionFrame = { position, level, concept };
  const previousStems = answers.map((answer) => answer.stem);

  return kind === "code"
    ? runPipeline(context.model, request, frame, codePipeline(context, previousStems))
    : runPipeline(
        context.model,
        request,
        frame,
        choicePipeline(kind, topic, seed, position, previousStems),
      );
}
