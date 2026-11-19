import type { ErrorCode } from "@ai-in-learning/shared-types";

import type { RequestFailure } from "../api/client.js";

/**
 * Sessions a visitor can start per hour: the `sessions` limiter of plan §11.1
 * (NFR-4, D3). The limit lives in `core/server`, which the quiz must not import,
 * so a change there must be copied here.
 */
export const SESSIONS_PER_HOUR = 5;

/** What the error screen does when the visitor acts on it. */
export type ErrorAction = "retry" | "home";

export interface ErrorContent {
  readonly title: string;
  /** The visitor message of plan §7.3. Never upstream text (AC-8.4). */
  readonly message: string;
  readonly action: ErrorAction;
  readonly actionLabel: string;
}

const RETRY = { action: "retry", actionLabel: "Retry" } as const;
const RETRY_TITLE = "We couldn't load your question";

const CATALOGUE: Readonly<Record<ErrorCode, (failure: RequestFailure) => ErrorContent>> = {
  invalid_request: () => ({
    title: "This session can't continue",
    message: "Something went wrong with this session. Please start a new one.",
    action: "home",
    actionLabel: "Start a new session",
  }),
  rate_limited: ({ retryAfterSeconds }) => ({
    title: "Usage limit reached",
    message: `This demo is limited to ${String(SESSIONS_PER_HOUR)} quizzes per hour. ${waitSentence(retryAfterSeconds)}`,
    action: "home",
    actionLabel: "Back to home",
  }),
  budget_exhausted: () => ({
    title: "Demo temporarily unavailable",
    message:
      "The demo is temporarily unavailable because its monthly AI budget is used up. Please come back later.",
    action: "home",
    actionLabel: "Back to home",
  }),
  ai_unavailable: () => ({
    title: RETRY_TITLE,
    message: "The AI service is not responding. Try again.",
    ...RETRY,
  }),
  generation_failed: () => ({
    title: RETRY_TITLE,
    message: "We couldn't prepare a good question. Try again.",
    ...RETRY,
  }),
  internal: () => ({
    title: RETRY_TITLE,
    message: "Something went wrong. Try again.",
    ...RETRY,
  }),
};

/** The error screen content for a failure (plan §7.3, AC-8.1 to AC-8.4). */
export function errorContent(failure: RequestFailure): ErrorContent {
  return CATALOGUE[failure.code](failure);
}

/** When the visitor can try again, rounded up to the minute (AC-8.2). */
function waitSentence(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) {
    return "You can start again later.";
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `You can start again in about ${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}.`;
}
