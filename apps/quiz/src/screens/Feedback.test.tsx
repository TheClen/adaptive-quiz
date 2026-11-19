import type { LevelChange } from "@ai-in-learning/core";
import type { Level, NextQuestionResponse, OptionId } from "@ai-in-learning/shared-types";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ChoiceQuestion } from "../app/sessionReducer.js";
import { expectNoAxeViolations } from "../testing/axe.js";
import {
  firstQuestion,
  multipleChoiceQuestion,
  singleChoiceWithSnippet,
} from "../testing/fixtures.js";
import { Feedback } from "./Feedback.js";

function renderFeedback({
  question,
  selectedIds,
  correct,
  levelChange = "none",
  level = 3,
  withNext = true,
}: {
  readonly question: NextQuestionResponse & { readonly question: ChoiceQuestion };
  readonly selectedIds: readonly OptionId[];
  readonly correct: boolean;
  readonly levelChange?: LevelChange;
  readonly level?: Level;
  readonly withNext?: boolean;
}) {
  const onNext = vi.fn<() => void>();
  const user = userEvent.setup();
  const { container } = render(
    <Feedback
      question={question}
      selectedIds={selectedIds}
      correct={correct}
      levelChange={levelChange}
      level={level}
      onNext={withNext ? onNext : null}
    />,
  );
  return { onNext, user, container };
}

/** The tags of each option ("Correct answer", "Your answer"), keyed by its text. */
function optionTags(): Record<string, string[]> {
  return Object.fromEntries(
    within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((item) => {
        const [text, tags] = Array.from(item.children);
        return [
          text?.textContent ?? "",
          Array.from(tags?.children ?? [], (tag) => tag.textContent),
        ];
      }),
  );
}

describe("Feedback for a single-choice answer", () => {
  it("shows the verdict, the correct option and the explanation (AC-6.1)", async () => {
    const { container } = renderFeedback({
      question: firstQuestion,
      selectedIds: ["b"],
      correct: true,
      levelChange: "up",
      level: 4,
    });

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Correct");
    // The verdict is in words, the icon only reinforces it (plan §13.3).
    expect(heading.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Question 1 · Closures")).toBeDefined();
    expect(screen.getByText(firstQuestion.question.prompt)).toBeDefined();
    expect(optionTags()).toEqual({
      "1": [],
      "2": ["Correct answer", "Your answer"],
      undefined: [],
      "It throws a ReferenceError": [],
    });
    expect(screen.getByRole("heading", { level: 2, name: "Explanation" })).toBeDefined();
    expect(screen.getByText(firstQuestion.question.explanation)).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("↑Level up: 4/5");
    await expectNoAxeViolations(container);
  });

  it("shows the visitor's wrong answer next to the correct one (AC-6.1)", () => {
    renderFeedback({
      question: firstQuestion,
      selectedIds: ["c"],
      correct: false,
      levelChange: "down",
      level: 2,
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Incorrect");
    expect(optionTags()).toMatchObject({ "2": ["Correct answer"], undefined: ["Your answer"] });
    expect(screen.getByRole("status").textContent).toBe("↓Level down: 2/5");
  });

  it("shows the snippet of the question again", () => {
    renderFeedback({ question: singleChoiceWithSnippet, selectedIds: ["b"], correct: true });

    expect(screen.getByRole("group", { name: "Code snippet, JavaScript" })).toBeDefined();
  });
});

describe("Feedback for a multiple-choice answer", () => {
  it("marks every correct option, including those the visitor missed (AC-6.1)", async () => {
    const { container } = renderFeedback({
      question: multipleChoiceQuestion,
      selectedIds: ["a", "b"],
      correct: false,
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Incorrect");
    expect(optionTags()).toEqual({
      "todo.id": ["Correct answer", "Your answer"],
      "Math.random()": ["Your answer"],
      "A slug unique among the todos": ["Correct answer"],
      "The index, when the list is reordered": [],
    });
    expect(screen.getByRole("status").textContent).toBe("");
    await expectNoAxeViolations(container);
  });
});

describe("Feedback navigation", () => {
  it('calls onNext from "Next question" (AC-6.4)', async () => {
    const { onNext, user } = renderFeedback({
      question: firstQuestion,
      selectedIds: ["b"],
      correct: true,
    });

    await user.click(screen.getByRole("button", { name: "Next question" }));

    expect(onNext).toHaveBeenCalledOnce();
  });

  it('has no "Next question" after the last question', () => {
    renderFeedback({ question: firstQuestion, selectedIds: ["b"], correct: true, withNext: false });

    expect(screen.queryByRole("button", { name: "Next question" })).toBeNull();
  });
});
