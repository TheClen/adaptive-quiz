import type { TestResult } from "@ai-in-learning/core/runner";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ReviewStatus } from "../app/sessionReducer.js";
import {
  REVIEW_LOADING,
  REVIEW_NOTICE,
  REVIEW_UNAVAILABLE,
} from "../components/CodeReviewPanel.js";
import { expectNoAxeViolations } from "../testing/axe.js";
import {
  codeQuestion,
  failingResults,
  negativeReview,
  passingResults,
} from "../testing/fixtures.js";
import { CodeFeedback } from "./CodeFeedback.js";

const SUBMITTED =
  "function sum(numbers) {\n  let t = 0;\n  for (const n of numbers) t += n;\n  return t;\n}";

function renderCodeFeedback({
  review,
  testResults = passingResults,
  correct = true,
  isLast = false,
}: {
  readonly review: ReviewStatus;
  readonly testResults?: readonly TestResult[];
  readonly correct?: boolean;
  readonly isLast?: boolean;
}) {
  const onNext = vi.fn<() => void>();
  const onRetryReview = vi.fn<() => void>();
  const user = userEvent.setup();
  const { container } = render(
    <CodeFeedback
      question={codeQuestion}
      code={SUBMITTED}
      testResults={testResults}
      correct={correct}
      levelChange={correct ? "up" : "down"}
      level={correct ? 5 : 3}
      review={review}
      isLast={isLast}
      onNext={onNext}
      onRetryReview={onRetryReview}
    />,
  );
  return { onNext, onRetryReview, user, container };
}

function reviewPanel() {
  return within(screen.getByRole("region", { name: "AI review" }));
}

const flattened = (code: string) => code.replaceAll("\n", "");

describe("CodeFeedback", () => {
  it("shows the test results and the reference solution while the review loads (AC-6.2)", async () => {
    const { container } = renderCodeFeedback({ review: { status: "pending", requestId: 1 } });

    expect(screen.getByRole("heading", { level: 1, name: "Correct" })).toBeDefined();
    expect(screen.getByText("All 3 tests passed")).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Reference solution" }).textContent).toBe(
      flattened(codeQuestion.question.referenceSolution),
    );
    const submitted = screen.getByRole("textbox", { name: "Your solution" });
    expect(submitted.textContent).toBe(flattened(SUBMITTED));
    expect(submitted.getAttribute("aria-readonly")).toBe("true");
    expect(screen.getByText(codeQuestion.question.explanation)).toBeDefined();
    expect(reviewPanel().getByText(REVIEW_LOADING)).toBeDefined();
    expect(screen.getByRole("button", { name: "Next question" })).toBeDefined();
    await expectNoAxeViolations(container);
  });

  it("shows the failed tests with their reasons", () => {
    renderCodeFeedback({
      review: { status: "pending", requestId: 1 },
      testResults: failingResults,
      correct: false,
    });

    expect(screen.getByRole("heading", { level: 1, name: "Incorrect" })).toBeDefined();
    expect(screen.getByText("2 of 3 tests passed")).toBeDefined();
    expect(screen.getByText("Expected 0 but got undefined")).toBeDefined();
  });

  it("then shows the review: summary and comments by aspect (AC-6.2)", async () => {
    const { container } = renderCodeFeedback({
      review: { status: "ready", review: negativeReview.review },
    });

    const panel = reviewPanel();
    expect(panel.getByText(negativeReview.review.summary)).toBeDefined();
    expect(
      panel.getAllByRole("listitem").map((item) => Array.from(item.children, (c) => c.textContent)),
    ).toEqual([
      ["Correctness", "The loop skips the last element."],
      ["Readability", "Name the accumulator `total` rather than `t`."],
      ["Idiomatic use", "`reduce` expresses a sum more directly than a `for` loop."],
    ]);
    expect(panel.getByText(REVIEW_NOTICE)).toBeDefined();
    expect(panel.queryByText(REVIEW_LOADING)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('still shows "Correct" when the review says the code is wrong on passing tests (AC-6.3)', () => {
    renderCodeFeedback({ review: { status: "ready", review: negativeReview.review } });

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Correct");
    expect(screen.queryByText("Incorrect")).toBeNull();
  });

  it('shows "The AI review is unavailable" with Retry, and keeps "Next question" (plan §10)', async () => {
    const { onNext, onRetryReview, user, container } = renderCodeFeedback({
      review: { status: "failed" },
    });

    expect(reviewPanel().getByText(REVIEW_UNAVAILABLE)).toBeDefined();
    await expectNoAxeViolations(container);

    await user.click(reviewPanel().getByRole("button", { name: "Retry" }));
    expect(onRetryReview).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('offers "See your results" after the last question', () => {
    renderCodeFeedback({ review: { status: "failed" }, isLast: true });

    expect(screen.getByRole("button", { name: "See your results" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Next question" })).toBeNull();
  });
});
