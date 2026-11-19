/**
 * Quality gate M1 (plan §8.1, §16.3): generates 30 questions per topic with the real
 * Anthropic adapter, writes a review sheet and the raw results to `apps/api/samples/`
 * (ignored by git), and prints token usage and cost per session.
 *
 * This is a manual check run by the project owner with the quiz workspace's key, never
 * a test (principle VI). It costs a few cents per run.
 *
 *   pnpm --filter @ai-in-learning/api sample-questions [--topic javascript|react]
 *
 * `ANTHROPIC_API_KEY` comes from the environment or `apps/api/.env`.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { createRunner, RUN_TIMEOUT_MS } from "@ai-in-learning/core/runner";
import { createAnthropicModelClient } from "@ai-in-learning/core/server";
import { TopicId } from "@ai-in-learning/shared-types";

import {
  formatUsd,
  renderReviewSheet,
  type SampledQuestion,
  type SampledSession,
  type SampleRun,
  sampleSession,
  SESSION_PLANS,
  sessionCalls,
  totals,
} from "./sampling.js";

const OUTPUT_DIRECTORY = new URL("../samples/", import.meta.url);

function readTopics(): TopicId[] {
  const { values } = parseArgs({ options: { topic: { type: "string" } } });
  if (values.topic === undefined) return [...TopicId.options];
  const topic = TopicId.safeParse(values.topic);
  if (!topic.success) {
    throw new Error(`--topic must be one of: ${TopicId.options.join(", ")}`);
  }
  return [topic.data];
}

function currentCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function progress(session: Pick<SampledSession, "topic" | "plan">, question: SampledQuestion) {
  const label = `[${session.topic} ${session.plan}] ${String(question.position)}/10`;
  const { response } = question;
  const calls = question.tries.reduce(
    (count, attempt) => count + ("attempts" in attempt ? attempt.attempts.length : 0),
    0,
  );
  console.log(
    response === null
      ? `${label} failed after ${String(question.tries.length)} tries`
      : `${label} ${response.question.kind}, level ${String(response.level)}, ${response.conceptId} (${String(calls)} model call${calls === 1 ? "" : "s"})`,
  );
}

function printUsage(run: SampleRun) {
  console.log("\nToken usage and cost per session:");
  for (const session of run.sessions) {
    const sum = totals(sessionCalls(session));
    console.log(
      `  ${session.topic} ${session.plan}: ${String(sum.calls)} calls, input ${String(sum.inputTokens)}, output ${String(sum.outputTokens)}, cache read ${String(sum.cacheReadInputTokens)}, cache write ${String(sum.cacheCreationInputTokens)}, ${formatUsd(sum.costUsd)}`,
    );
  }
  const all = totals(run.sessions.flatMap(sessionCalls));
  const mean = all.costUsd === null ? null : all.costUsd / run.sessions.length;
  console.log(`  Total ${formatUsd(all.costUsd)}; mean per session ${formatUsd(mean)}`);
}

async function main() {
  const topics = readTopics();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey === undefined || apiKey === "") {
    throw new Error("ANTHROPIC_API_KEY is not set (see apps/api/.env.example)");
  }

  const startedAt = new Date().toISOString();
  const context = {
    model: createAnthropicModelClient({ apiKey }),
    runner: createRunner({ timeoutMs: RUN_TIMEOUT_MS.server }),
    // Exercise tokens only need to verify within this run.
    signingSecret: randomBytes(32).toString("hex"),
    onQuestion: progress,
  };

  // Sessions run in parallel; questions within a session run in order, as for a visitor.
  const settled = await Promise.allSettled(
    topics.flatMap((topic) => SESSION_PLANS.map((plan) => sampleSession(context, topic, plan))),
  );
  const sessions = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const errors = settled.flatMap((result): unknown[] =>
    result.status === "rejected" ? [result.reason] : [],
  );

  const run: SampleRun = { startedAt, commit: currentCommit(), sessions };
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const name = `m1-${startedAt.replaceAll(/[:.]/gu, "-")}`;
  const sheet = new URL(`${name}.md`, OUTPUT_DIRECTORY);
  const raw = new URL(`${name}.json`, OUTPUT_DIRECTORY);
  await writeFile(sheet, renderReviewSheet(run));
  await writeFile(raw, `${JSON.stringify(run, null, 2)}\n`);

  printUsage(run);
  console.log(`\nReview sheet: ${sheet.pathname}\nRaw results:  ${raw.pathname}`);
  if (errors.length > 0) {
    for (const error of errors) console.error("Session aborted:", error);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
