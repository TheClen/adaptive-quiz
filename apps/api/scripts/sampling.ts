/**
 * The sampling behind quality gate M1 (plan §8.1, §16.3): simulated sessions run
 * through the real generation pipeline, their token usage and cost, and the review
 * sheet the project owner fills in. The entry point is `sample-questions.ts`.
 */
import { levelHistory, questionStem, selectNextConcept } from "@ai-in-learning/core";
import type { Runner } from "@ai-in-learning/core/runner";
import {
  ChoiceDraft,
  type GenerationAttempt,
  generateQuestion,
  type ModelClient,
  ModelError,
  type ModelErrorCode,
  type ModelRequest,
  type ModelResult,
  type ModelUsage,
  type RetryReason,
  type ReviewAttempt,
  reviewCode,
} from "@ai-in-learning/core/server";
import {
  type AnsweredQuestion,
  type CodeReviewResponse,
  type NextQuestionResponse,
  SESSION_LENGTH,
  type TopicId,
} from "@ai-in-learning/shared-types";

/**
 * One simulated session: its seed, and whether each of the first nine answers is
 * correct. The answers drive the level and the concept revisits, so a fixed plan
 * gives the same levels, kinds and concepts on every run, and runs before and after
 * prompt tuning can be compared.
 */
export interface SessionPlan {
  readonly name: string;
  readonly seed: number;
  /** Outcome of the answers to questions 1 to 9. The tenth answer moves nothing. */
  readonly correct: readonly boolean[];
}

/**
 * Three sessions per topic, 30 questions. Each session climbs to level 5 and falls to
 * level 1, so together they cover every level, every kind (the schedule of plan §6.2
 * puts code exercises at levels 1, 2, 4 and 5) and concept revisits after a miss.
 *
 * - A: 3 4 5 4 3 2 1 2 3 4
 * - B: 3 2 1 2 3 4 5 4 3 2
 * - C: 3 4 5 5 4 3 2 1 1 2
 */
export const SESSION_PLANS = [
  { name: "A", seed: 1_801, correct: [true, true, false, false, false, false, true, true, true] },
  { name: "B", seed: 1_802, correct: [false, false, true, true, true, true, false, false, false] },
  { name: "C", seed: 1_803, correct: [true, true, true, false, false, false, false, false, true] },
] as const satisfies readonly SessionPlan[];

/**
 * How many times a position is generated before the session stops: the first
 * request, then two uses of the visitor's Retry (AC-8.1).
 */
export const MAX_TRIES_PER_POSITION = 3;

/** One `generateQuestion` call: up to two model calls (D4), or an upstream error. */
export type SampleTry =
  | {
      readonly outcome: "accepted" | "generation_failed";
      readonly attempts: readonly GenerationAttempt[];
      readonly durationMs: number;
    }
  | {
      /** `ai_unavailable` after the SDK's own retry. Its usage is unknown. */
      readonly outcome: "upstream_error";
      readonly code: ModelErrorCode;
      readonly durationMs: number;
    };

export interface SampledQuestion {
  readonly position: number;
  /** True when the concept comes back after a miss (plan §6.4). */
  readonly revisit: boolean;
  readonly tries: readonly SampleTry[];
  /** The question as the visitor would get it, or `null` when every try failed. */
  readonly response: NextQuestionResponse | null;
  /**
   * The model's rationale for each option, in the order of `response.question.options`.
   * The visitor never sees them; they help the review.
   */
  readonly rationales: readonly (string | null)[];
}

/** The review of a code exercise's reference solution, to measure the review route. */
export interface SampledReview {
  readonly position: number;
  readonly outcome: "accepted" | "generation_failed" | "invalid_request" | "upstream_error";
  readonly attempts: readonly ReviewAttempt[];
  readonly review: CodeReviewResponse["review"] | null;
}

export interface SampledSession {
  readonly topic: TopicId;
  readonly plan: string;
  readonly seed: number;
  readonly questions: readonly SampledQuestion[];
  readonly reviews: readonly SampledReview[];
  /** Why the session ended before question 10, or `null`. */
  readonly stoppedBy: string | null;
}

/** What a sampled session needs: the model, the runner and an exercise key. */
export interface SamplingContext {
  readonly model: ModelClient;
  readonly runner: Runner;
  readonly signingSecret: string;
  /** Called after each position, for progress output. */
  readonly onQuestion?: (
    session: Pick<SampledSession, "topic" | "plan">,
    question: SampledQuestion,
  ) => void;
}

/**
 * Keeps the output of each model call, so the review sheet can show the option
 * rationales that normalisation drops (plan §8.3).
 */
class RecordingModelClient implements ModelClient {
  readonly outputs: unknown[] = [];
  readonly #inner: ModelClient;

  constructor(inner: ModelClient) {
    this.#inner = inner;
  }

  async generate<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    const result = await this.#inner.generate(request);
    this.outputs.push(result.ok ? result.output : null);
    return result;
  }
}

/** The rationale of each option of the accepted draft, matched by option text. */
function rationalesOf(response: NextQuestionResponse, draft: unknown): (string | null)[] {
  const { question } = response;
  const parsed = ChoiceDraft.safeParse(draft);
  if (question.kind === "code" || !parsed.success) return [];
  const byText = new Map(parsed.data.options.map((option) => [option.text, option.rationale]));
  return question.options.map((option) => byText.get(option.text) ?? null);
}

/** Retryable upstream failures count as a try; any other one stops the whole run. */
function upstreamCode(error: unknown): ModelErrorCode {
  if (error instanceof ModelError && error.code === "ai_unavailable") return error.code;
  throw error;
}

async function sampleQuestion(
  context: SamplingContext,
  recorder: RecordingModelClient,
  state: { readonly topic: TopicId; readonly seed: number; readonly answers: AnsweredQuestion[] },
): Promise<SampledQuestion> {
  const position = state.answers.length + 1;
  const { revisit } = selectNextConcept(state.topic, state.seed, state.answers);
  const generation = {
    model: recorder,
    runner: context.runner,
    signingSecret: context.signingSecret,
  };
  const tries: SampleTry[] = [];

  while (tries.length < MAX_TRIES_PER_POSITION) {
    const started = performance.now();
    try {
      const result = await generateQuestion(generation, state);
      const durationMs = Math.round(performance.now() - started);
      tries.push({
        outcome: result.ok ? "accepted" : result.code,
        attempts: result.attempts,
        durationMs,
      });
      if (result.ok) {
        const rationales = rationalesOf(result.response, recorder.outputs.at(-1));
        return { position, revisit, tries, response: result.response, rationales };
      }
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      tries.push({ outcome: "upstream_error", code: upstreamCode(error), durationMs });
    }
  }
  return { position, revisit, tries, response: null, rationales: [] };
}

async function sampleReview(
  context: SamplingContext,
  topic: TopicId,
  position: number,
  response: NextQuestionResponse,
): Promise<SampledReview | null> {
  const { question } = response;
  if (question.kind !== "code") return null;
  try {
    const result = await reviewCode(context, {
      topic,
      conceptId: response.conceptId,
      level: response.level,
      exercise: question,
      code: question.referenceSolution,
    });
    return {
      position,
      outcome: result.ok ? "accepted" : result.code,
      attempts: result.attempts,
      review: result.ok ? result.response.review : null,
    };
  } catch (error) {
    upstreamCode(error);
    return { position, outcome: "upstream_error", attempts: [], review: null };
  }
}

/**
 * Plays one session of `plan` against the real pipeline: generates each question,
 * reviews each code exercise's reference solution, then answers with the plan's
 * outcome, as a visitor would. A position that fails {@link MAX_TRIES_PER_POSITION}
 * times stops the session, because the next question needs its stem.
 *
 * Throws on upstream failures other than `ai_unavailable` (spend limit reached,
 * configuration error): the rest of the run would fail the same way.
 */
export async function sampleSession(
  context: SamplingContext,
  topic: TopicId,
  plan: SessionPlan,
): Promise<SampledSession> {
  const recorder = new RecordingModelClient(context.model);
  const answers: AnsweredQuestion[] = [];
  const questions: SampledQuestion[] = [];
  const reviews: SampledReview[] = [];

  while (answers.length < SESSION_LENGTH) {
    const sampled = await sampleQuestion(context, recorder, { topic, seed: plan.seed, answers });
    questions.push(sampled);
    context.onQuestion?.({ topic, plan: plan.name }, sampled);
    const { response } = sampled;
    if (response === null) {
      const stoppedBy = `question ${String(sampled.position)} failed ${String(MAX_TRIES_PER_POSITION)} times`;
      return { topic, plan: plan.name, seed: plan.seed, questions, reviews, stoppedBy };
    }

    const review = await sampleReview(context, topic, sampled.position, response);
    if (review !== null) reviews.push(review);
    answers.push({
      kind: response.question.kind,
      conceptId: response.conceptId,
      correct: plan.correct[answers.length] ?? true,
      stem: questionStem(response.question),
    });
  }
  return { topic, plan: plan.name, seed: plan.seed, questions, reviews, stoppedBy: null };
}

/** The levels a plan gives its ten questions. */
export function planLevels(plan: SessionPlan): number[] {
  return levelHistory(plan.correct.map((correct) => ({ correct })));
}

// --- Usage and cost -------------------------------------------------------------

/** Prices in US dollars per million tokens, for prompts up to 100K tokens. */
export interface Prices {
  readonly input: number;
  readonly output: number;
  /** 5-minute cache write: 1.25 times the input price. */
  readonly cacheWrite: number;
  readonly cacheRead: number;
}

/**
 * Standard API prices (checked on 2026-11-19). Claude Sonnet 5.5 is listed for the
 * escalation rule of plan §8.1, so a run on it is priced too.
 */
export const PRICES_PER_MTOK: Readonly<Record<string, Prices>> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
};

/** One model call, from either route. */
export interface CallUsage {
  readonly model: string;
  readonly usage: ModelUsage;
}

export interface UsageTotals extends ModelUsage {
  readonly calls: number;
  /** In US dollars, or `null` when a call used a model without a price. */
  readonly costUsd: number | null;
}

/** Every model call of a session: generation attempts, retries included, and reviews. */
export function sessionCalls(session: SampledSession): CallUsage[] {
  const generation = session.questions.flatMap((question) =>
    question.tries.flatMap((attempt) => ("attempts" in attempt ? attempt.attempts : [])),
  );
  const reviews = session.reviews.flatMap((review) => review.attempts);
  return [...generation, ...reviews];
}

function callCost({ model, usage }: CallUsage): number | null {
  const prices = PRICES_PER_MTOK[model];
  if (prices === undefined) return null;
  const dollars =
    usage.inputTokens * prices.input +
    usage.outputTokens * prices.output +
    usage.cacheCreationInputTokens * prices.cacheWrite +
    usage.cacheReadInputTokens * prices.cacheRead;
  return dollars / 1_000_000;
}

export function totals(calls: readonly CallUsage[]): UsageTotals {
  let costUsd: number | null = 0;
  for (const call of calls) {
    const cost = callCost(call);
    costUsd = cost === null || costUsd === null ? null : costUsd + cost;
  }
  const sum = (field: keyof ModelUsage) =>
    calls.reduce((total, call) => total + call.usage[field], 0);
  return {
    calls: calls.length,
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    cacheReadInputTokens: sum("cacheReadInputTokens"),
    cacheCreationInputTokens: sum("cacheCreationInputTokens"),
    costUsd,
  };
}

// --- Review sheet ---------------------------------------------------------------

export interface SampleRun {
  /** ISO timestamp of the start of the run. */
  readonly startedAt: string;
  /** Commit of the prompts, so results can be tied to a prompt version. */
  readonly commit: string;
  readonly sessions: readonly SampledSession[];
}

export function formatUsd(costUsd: number | null): string {
  return costUsd === null ? "unknown (no price for the model)" : `$${costUsd.toFixed(4)}`;
}

function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

function describeRejection(reason: RetryReason): string {
  const { rule, ...details } = reason;
  const values = Object.values(details).map(String);
  return values.length === 0 ? rule : `${rule} (${values.join(", ")})`;
}

function describeTries(tries: readonly SampleTry[]): string {
  return tries
    .map((attempt) => {
      if (attempt.outcome === "upstream_error") return `upstream error ${attempt.code}`;
      const rejections = attempt.attempts.flatMap((call) =>
        call.rejection === null ? [] : [describeRejection(call.rejection)],
      );
      const calls = `${String(attempt.attempts.length)} call${attempt.attempts.length === 1 ? "" : "s"}`;
      const rejected = rejections.length === 0 ? "" : `, rejected: ${rejections.join("; ")}`;
      return `${attempt.outcome} (${calls}${rejected}, ${(attempt.durationMs / 1000).toFixed(1)} s)`;
    })
    .join(" → ");
}

function fence(language: string, source: string): string {
  const longest = Math.max(2, ...[...source.matchAll(/`+/gu)].map((match) => match[0].length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}${language}\n${source.trimEnd()}\n${ticks}`;
}

function renderQuestion(number: number, session: SampledSession, sampled: SampledQuestion): string {
  const lines: string[] = [];
  const { response } = sampled;
  const heading = `### ${String(number)}. Session ${session.plan}, question ${String(sampled.position)}`;
  if (response === null) {
    lines.push(heading, "", `Not generated: ${describeTries(sampled.tries)}.`);
    return lines.join("\n");
  }

  const { question } = response;
  const revisit = sampled.revisit ? ", revisit after a miss" : "";
  lines.push(
    `${heading}: ${question.kind}, level ${String(response.level)}, ${response.conceptLabel}${revisit}`,
    "",
    `Generation: ${describeTries(sampled.tries)}.`,
    "",
    question.prompt,
    "",
  );

  if (question.kind === "code") {
    lines.push(
      "Starter code:",
      "",
      fence("javascript", question.starterCode),
      "",
      "Reference solution:",
      "",
      fence("javascript", question.referenceSolution),
      "",
      "Tests:",
      "",
    );
    for (const test of question.tests) {
      const immutability = test.checksImmutability ? " (checks immutability)" : "";
      lines.push(
        `- ${test.description}${immutability}: \`${question.functionName}(${test.args.map((arg) => JSON.stringify(arg)).join(", ")})\` → \`${JSON.stringify(test.expected)}\``,
      );
    }
  } else {
    if (question.snippet !== null) {
      lines.push(fence(question.snippet.language, question.snippet.source), "");
    }
    const correct = new Set<string>(
      question.kind === "single" ? [question.correctOptionId] : question.correctOptionIds,
    );
    question.options.forEach((option, index) => {
      const mark = correct.has(option.id) ? "✅" : "❌";
      const rationale = sampled.rationales[index];
      lines.push(`- ${mark} **${option.id}.** ${option.text}`);
      if (rationale !== undefined && rationale !== null)
        lines.push(`  - _Rationale:_ ${rationale}`);
    });
  }

  lines.push(
    "",
    `Explanation: ${question.explanation}`,
    "",
    "**Verdict:** ☐ OK ☐ Defective — reason:",
  );
  return lines.join("\n");
}

function renderSummary(run: SampleRun, topic: TopicId): string[] {
  const sessions = run.sessions.filter((session) => session.topic === topic);
  const sampled = sessions.flatMap((session) => session.questions);
  const accepted = sampled.filter((question) => question.response !== null);
  const failedTries = sampled
    .flatMap((question) => question.tries)
    .filter((attempt) => attempt.outcome !== "accepted").length;
  const retried = accepted.filter((question) =>
    question.tries.some((attempt) => "attempts" in attempt && attempt.attempts.length > 1),
  ).length;
  const durations = sampled.flatMap((question) =>
    question.tries
      .filter((attempt) => attempt.outcome === "accepted")
      .map((attempt) => attempt.durationMs),
  );
  const medianMs = median(durations);

  const lines = [
    `- Questions generated: ${String(accepted.length)} of ${String(sampled.length)} requested (${String(sessions.length * SESSION_LENGTH)} planned)`,
    `- Accepted after the automatic retry: ${String(retried)}; failed tries (visitor would see an error): ${String(failedTries)}`,
    `- Median generation time of an accepted question: ${medianMs === null ? "n/a" : `${(medianMs / 1000).toFixed(1)} s`}`,
    "",
    "| Session | Questions | Model calls | Input | Output | Cache read | Cache write | Cost |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const session of sessions) {
    const sum = totals(sessionCalls(session));
    const count = session.questions.filter((question) => question.response !== null).length;
    const stopped = session.stoppedBy === null ? "" : ` (stopped: ${session.stoppedBy})`;
    lines.push(
      `| ${session.plan} | ${String(count)}${stopped} | ${String(sum.calls)} | ${String(sum.inputTokens)} | ${String(sum.outputTokens)} | ${String(sum.cacheReadInputTokens)} | ${String(sum.cacheCreationInputTokens)} | ${formatUsd(sum.costUsd)} |`,
    );
  }
  return lines;
}

/**
 * The review sheet in Markdown: per topic, a usage summary, then every question with
 * its correct options, rationales, explanation and an empty verdict for the owner.
 */
export function renderReviewSheet(run: SampleRun): string {
  const lines = [
    "# Quality gate M1: question sample",
    "",
    `Run started ${run.startedAt} on commit \`${run.commit}\`. Review each question against the M1 checklist in \`specs/001-adaptive-quiz-mvp/checks.md\`, then record the result there.`,
    "",
    "Costs include every model call: generation retries and one review of each code exercise's reference solution.",
  ];
  const topics = [...new Set(run.sessions.map((session) => session.topic))];
  for (const topic of topics) {
    lines.push("", `## Topic: ${topic}`, "", ...renderSummary(run, topic));
    let number = 0;
    for (const session of run.sessions.filter((candidate) => candidate.topic === topic)) {
      for (const question of session.questions) {
        number += 1;
        lines.push("", renderQuestion(number, session, question));
      }
    }
  }
  return `${lines.join("\n")}\n`;
}
