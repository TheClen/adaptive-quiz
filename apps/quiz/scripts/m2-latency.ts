/**
 * Manual checks M2 and M5 (plan §16.3): plays whole sessions on the deployed demo,
 * keyboard only, and measures how long the next question takes.
 *
 * This is not a test: it calls the real API, so the Anthropic API and Upstash
 * (principle VI). It is excluded from `turbo test` and run by hand, within the API's
 * limits (plan §11.1): 5 sessions and 60 questions per hour from one IP.
 *
 * Usage: `node scripts/m2-latency.ts --topic javascript [--sessions 3] [--pause 10000]
 * [--url https://…] [--headed]`.
 *
 * For each question it records:
 * - `readyMs`: from the key press on Submit (or on the topic, for question 1) to
 *   the end of the `next-question` response. This is the latency without prefetch.
 * - `loadingMs`: for question 1, from the key press to the loading status (NFR-1).
 * - `shownMs`: from the key press on "Next question", after a reading pause, to the
 *   question's heading taking focus. This is the latency with prefetch.
 *
 * Sessions alternate between 1024 and 1440 px wide (NFR-7). Every screen is
 * scanned with axe and checked for horizontal overflow, and every control is
 * reached with Tab, so a focus trap stops the session (NFR-2). Results go to
 * `test-results/m2-<time>.json`, which git ignores, with failed requests and a
 * screenshot of the page where a session stopped.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import type { NextQuestionResponse, Question, TopicId } from "@ai-in-learning/shared-types";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Locator, type Page } from "@playwright/test";

const DEFAULT_URL = "https://adaptive-quiz-sooty.vercel.app";
const TOPIC_LABELS = { javascript: "JavaScript", react: "React" } as const satisfies Record<
  TopicId,
  string
>;
const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;
/** The positions answered wrongly, as in the end-to-end suite. */
const WRONG_POSITIONS = new Set([3, 8]);
/** Presses Tab at most this many times to reach a control. */
const MAX_TABS = 60;
/** Longer than the API's own limit (`maxDuration` 60 s). */
const RESPONSE_TIMEOUT_MS = 90_000;

interface QuestionRecord {
  position: number;
  kind: Question["kind"];
  level: number;
  readyMs: number;
  loadingMs?: number;
  shownMs?: number;
  answeredCorrectly: boolean;
}

interface ScreenIssue {
  screen: string;
  issue: string;
}

interface SessionRecord {
  topic: TopicId;
  viewport: string;
  startedAt: string;
  questions: QuestionRecord[];
  issues: ScreenIssue[];
  completed: boolean;
  error?: string;
  /** The page when the session stopped. */
  screenshot?: string;
}

const { values } = parseArgs({
  options: {
    topic: { type: "string" },
    sessions: { type: "string", default: "3" },
    pause: { type: "string", default: "10000" },
    url: { type: "string", default: DEFAULT_URL },
    headed: { type: "boolean", default: false },
  },
});
const topic = values.topic;
if (topic !== "javascript" && topic !== "react") {
  throw new Error("Pass --topic javascript or --topic react.");
}
const sessionCount = Number(values.sessions);
const pauseMs = Number(values.pause);

async function isFocused(target: Locator): Promise<boolean> {
  return target.evaluate((element) => element === document.activeElement);
}

/** Presses Tab until `target` has focus, the way a keyboard user reaches it. */
async function tabTo(page: Page, target: Locator, what: string): Promise<void> {
  for (let presses = 0; presses < MAX_TABS; presses++) {
    if (await isFocused(target)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${what}: possible focus trap.`);
}

function button(page: Page, name: string): Locator {
  return page.getByRole("button", { name, exact: true });
}

function heading(page: Page, name: string | RegExp): Locator {
  return page.getByRole("heading", { level: 1, name });
}

/** Waits for the heading to take focus, as every new screen does (plan §13.3). */
async function waitForFocusedHeading(page: Page, name: string | RegExp): Promise<void> {
  const target = heading(page, name);
  await target.waitFor({ timeout: RESPONSE_TIMEOUT_MS });
  await page.waitForFunction(
    (element) => element === document.activeElement,
    await target.elementHandle(),
    { timeout: 5_000 },
  );
}

/** Scans the screen with axe and checks it fits the viewport's width. */
async function checkScreen(page: Page, screen: string, issues: ScreenIssue[]): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  for (const violation of results.violations) {
    const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
    issues.push({ screen, issue: `axe ${violation.id}: ${violation.help} (${targets})` });
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 0) {
    issues.push({ screen, issue: `horizontal overflow of ${String(overflow)} px` });
  }
}

/** Waits for the `next-question` response that `press` triggers and times it. */
async function timedQuestion(
  page: Page,
  press: () => Promise<void>,
  watchLoading = false,
): Promise<{ response: NextQuestionResponse; readyMs: number; loadingMs: number }> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/quiz/next-question") && response.request().method() === "POST",
    { timeout: RESPONSE_TIMEOUT_MS },
  );
  const loading = page.getByRole("status").getByRole("heading", { level: 1 });
  const start = performance.now();
  await press();
  // After Submit the feedback shows while the question is prefetched: no loading state.
  const loadingPromise = watchLoading
    ? loading.waitFor({ timeout: 5_000 }).then(
        () => performance.now() - start,
        () => Number.NaN,
      )
    : Promise.resolve(Number.NaN);
  const response = await responsePromise;
  await response.finished();
  const readyMs = performance.now() - start;
  if (!response.ok()) {
    throw new Error(
      `next-question returned ${String(response.status())}: ${await response.text()}`,
    );
  }
  return {
    response: (await response.json()) as NextQuestionResponse,
    readyMs,
    loadingMs: await loadingPromise,
  };
}

/** Answers a question with the keyboard and leaves focus on Submit. */
async function answer(page: Page, question: Question, correct: boolean): Promise<void> {
  if (question.kind === "single") {
    const index = question.options.findIndex(
      (option) => (option.id === question.correctOptionId) === correct,
    );
    await tabTo(page, page.getByRole("radio").first(), "the first option");
    await page.keyboard.press("Space");
    for (let step = 0; step < index; step++) {
      await page.keyboard.press("ArrowDown");
    }
  } else if (question.kind === "multiple") {
    const correctIds = new Set(question.correctOptionIds);
    for (const [index, option] of question.options.entries()) {
      if (correctIds.has(option.id) === correct) {
        await tabTo(page, page.getByRole("checkbox").nth(index), `option ${option.id}`);
        await page.keyboard.press("Space");
      }
    }
  } else {
    const editor = page.getByRole("textbox", { name: "Your solution" });
    await tabTo(page, editor, "the code editor");
    if (correct) {
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type(question.referenceSolution);
    }
    // Escape then Tab leaves the editor (NFR-2).
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    if (!(await isFocused(button(page, "Run tests")))) {
      throw new Error("Escape then Tab did not leave the code editor.");
    }
    await page.keyboard.press("Enter");
    await page
      .getByRole("status")
      .getByText(/tests? passed/)
      .waitFor();
  }
  await tabTo(page, button(page, "Submit"), "Submit");
}

async function playSession(page: Page, record: SessionRecord): Promise<void> {
  await page.goto(values.url);
  // On page load the browser keeps focus on the document; only later screens move it.
  await heading(page, "Adaptive Quiz").waitFor();
  await checkScreen(page, "home", record.issues);

  await tabTo(page, button(page, TOPIC_LABELS[record.topic]), "the topic button");
  let next = await timedQuestion(page, () => page.keyboard.press("Enter"), true);
  await waitForFocusedHeading(page, "Question 1");
  let shownMs: number | undefined;

  for (let position = 1; position <= 10; position++) {
    const { question, level } = next.response;
    const correct = !WRONG_POSITIONS.has(position);
    record.questions.push({
      position,
      kind: question.kind,
      level,
      readyMs: next.readyMs,
      answeredCorrectly: correct,
      ...(position === 1 ? { loadingMs: next.loadingMs } : {}),
      ...(shownMs === undefined ? {} : { shownMs }),
    });

    await checkScreen(page, `question ${String(position)} (${question.kind})`, record.issues);
    await answer(page, question, correct);
    const isLast = position === 10;
    // The prefetch runs while the visitor reads the feedback (plan §12).
    const prefetch = isLast ? null : timedQuestion(page, () => page.keyboard.press("Enter"));
    if (prefetch === null) {
      await page.keyboard.press("Enter");
    } else {
      // A failed prefetch is reported when "Next question" awaits it, not before.
      prefetch.catch(() => undefined);
    }

    await waitForFocusedHeading(page, /^(Correct|Incorrect)$/);
    const pauseStart = performance.now();
    await checkScreen(page, `feedback ${String(position)}`, record.issues);
    const remaining = pauseMs - (performance.now() - pauseStart);
    if (remaining > 0) {
      await page.waitForTimeout(remaining);
    }

    const nextLabel = isLast ? "See your results" : "Next question";
    await tabTo(page, button(page, nextLabel), nextLabel);
    const pressed = performance.now();
    await page.keyboard.press("Enter");
    if (prefetch !== null) {
      next = await prefetch;
      await waitForFocusedHeading(page, `Question ${String(position + 1)}`);
      shownMs = performance.now() - pressed;
    }
  }
  await waitForFocusedHeading(page, /out of 10 correct/);
  await checkScreen(page, "summary", record.issues);
  record.completed = true;
}

const directory = "test-results";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: !values.headed });
const sessions: SessionRecord[] = [];
try {
  for (let index = 0; index < sessionCount; index++) {
    const viewport = VIEWPORTS[index % VIEWPORTS.length] ?? VIEWPORTS[0];
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const record: SessionRecord = {
      topic,
      viewport: `${String(viewport.width)}x${String(viewport.height)}`,
      startedAt: new Date().toISOString(),
      questions: [],
      issues: [],
      completed: false,
    };
    sessions.push(record);
    // A request that never gets its response, such as one aborted by the quiz's
    // fetch timeout, shows here rather than as a response.
    page.on("requestfailed", (request) => {
      record.issues.push({
        screen: "network",
        issue: `${request.method()} ${new URL(request.url()).pathname} failed: ${
          request.failure()?.errorText ?? "unknown"
        }`,
      });
    });
    try {
      await playSession(page, record);
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      const screenshot = join(
        directory,
        `m2-${topic}-${record.startedAt.replaceAll(":", "-")}-stopped.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
      record.screenshot = screenshot;
    }
    await context.close();
    console.log(
      `${record.topic} session ${String(index + 1)} at ${record.viewport}: ${
        record.completed ? "completed" : `stopped (${record.error ?? "unknown"})`
      }`,
    );
  }
} finally {
  await browser.close();
}

function median(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

const questions = sessions.flatMap((session) => session.questions);
const ready = questions.map((question) => question.readyMs);
const shown = questions.flatMap((question) =>
  question.shownMs === undefined ? [] : [question.shownMs],
);
const loading = questions.flatMap((question) =>
  question.loadingMs === undefined ? [] : [question.loadingMs],
);
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
console.log(`\n${String(questions.length)} questions, reading pause ${String(pauseMs)} ms`);
console.log(
  `Without prefetch: median ${seconds(median(ready))}, max ${seconds(Math.max(...ready))}`,
);
for (const kind of ["single", "multiple", "code"] as const) {
  const ofKind = questions.filter((question) => question.kind === kind).map((q) => q.readyMs);
  if (ofKind.length > 0) {
    console.log(`  ${kind}: median ${seconds(median(ofKind))} over ${String(ofKind.length)}`);
  }
}
if (shown.length > 0) {
  console.log(
    `With prefetch: median ${seconds(median(shown))}, max ${seconds(Math.max(...shown))}`,
  );
}
const first = questions.filter((question) => question.position === 1).map((q) => q.readyMs);
if (first.length > 0) {
  console.log(`First question: median ${seconds(median(first))} over ${String(first.length)}`);
}
if (loading.length > 0) {
  console.log(`Loading status after Start: max ${String(Math.round(Math.max(...loading)))} ms`);
}
const completed = sessions.filter((session) => session.completed).length;
console.log(`Sessions completed: ${String(completed)} of ${String(sessions.length)}`);
for (const session of sessions) {
  for (const { screen, issue } of session.issues) {
    console.log(`Issue at ${session.viewport}, ${screen}: ${issue}`);
  }
}

const file = join(directory, `m2-${topic}-${new Date().toISOString().replaceAll(":", "-")}.json`);
await writeFile(file, `${JSON.stringify({ url: values.url, pauseMs, sessions }, null, 2)}\n`);
console.log(`\nResults written to ${file}`);
