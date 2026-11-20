import { levelHistory } from "@ai-in-learning/core";
import {
  type ApiError,
  CodeReviewRequest,
  CodeReviewResponse,
  type ErrorCode,
  NextQuestionRequest,
  NextQuestionResponse,
} from "@ai-in-learning/shared-types";
import type { Page, Route } from "@playwright/test";

import type { QuizFixture } from "../fixtures/types.js";

/** What the page sent to the mocked API. */
export interface MockedApi {
  /** The body of each `next-question` request, in the order they arrived. */
  readonly questionRequests: NextQuestionRequest[];
  /** The body of each `code-review` request, in the order they arrived. */
  readonly reviewRequests: CodeReviewRequest[];
  /**
   * Requests the mock could not answer: unknown paths, bodies that break the
   * contract, positions the fixture has no question for. Tests expect it empty.
   */
  readonly problems: string[];
}

/** An error response in the API's single error shape (plan §7.3). */
export function errorResponse(status: number, code: ErrorCode): { status: number; json: ApiError } {
  return { status, json: { error: { code, message: `Mocked ${code} error.` } } };
}

/**
 * Answers the quiz API from a fixture, in the browser: no request leaves the page,
 * and no test reaches the Anthropic API or Upstash (principle VI).
 *
 * Like the server, the mock parses each body with its `shared-types` schema and
 * derives the position and level of the next question from the answers it is
 * sent (AC-4.5). Each response is parsed with its schema too, so a broken
 * fixture fails the test instead of reaching the app.
 *
 * Tests can register their own route for a path afterwards: Playwright tries the
 * latest route first, and `route.fallback()` hands the request on to this mock.
 */
export async function mockQuizApi(page: Page, fixture: QuizFixture): Promise<MockedApi> {
  const api: MockedApi = { questionRequests: [], reviewRequests: [], problems: [] };

  function reject(route: Route, problem: string): Promise<void> {
    api.problems.push(problem);
    return route.fulfill(errorResponse(400, "invalid_request"));
  }

  // Registered first, so it only answers what the two routes below do not.
  await page.route("**/api/**", (route) => {
    const request = route.request();
    api.problems.push(`Unexpected request: ${request.method()} ${request.url()}`);
    return route.fulfill(errorResponse(404, "internal"));
  });

  await page.route("**/api/quiz/next-question", (route) => {
    const parsed = NextQuestionRequest.safeParse(route.request().postDataJSON());
    if (!parsed.success) {
      return reject(route, `Invalid next-question body: ${parsed.error.message}`);
    }
    const { state } = parsed.data;
    api.questionRequests.push(parsed.data);
    if (state.topic !== fixture.topic) {
      return reject(route, `next-question for ${state.topic}, fixture for ${fixture.topic}`);
    }
    const question = fixture.questions[state.answers.length];
    if (question === undefined) {
      return reject(route, `No fixture question at position ${String(state.answers.length + 1)}`);
    }
    const response = NextQuestionResponse.parse({
      ...question,
      position: state.answers.length + 1,
      level: levelHistory(state.answers).at(-1),
    });
    return route.fulfill({ json: response });
  });

  await page.route("**/api/quiz/code-review", (route) => {
    const parsed = CodeReviewRequest.safeParse(route.request().postDataJSON());
    if (!parsed.success) {
      return reject(route, `Invalid code-review body: ${parsed.error.message}`);
    }
    api.reviewRequests.push(parsed.data);
    const { functionName } = parsed.data.exercise;
    const review = fixture.reviews[functionName];
    if (review === undefined) {
      return reject(route, `No fixture review for ${functionName}`);
    }
    return route.fulfill({ json: CodeReviewResponse.parse({ review }) });
  });

  return api;
}
