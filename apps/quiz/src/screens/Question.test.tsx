import type { NextQuestionResponse, OptionId } from "@ai-in-learning/shared-types";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "../testing/axe.js";
import {
  firstQuestion,
  multipleChoiceQuestion,
  singleChoiceWithSnippet,
} from "../testing/fixtures.js";
import { Question } from "./Question.js";

function renderQuestion(question: NextQuestionResponse) {
  const onSubmit = vi.fn<(selectedIds: OptionId[]) => void>();
  const user = userEvent.setup();
  const { container } = render(<Question question={question} onSubmit={onSubmit} />);
  return { onSubmit, user, container };
}

function submitButton() {
  return screen.getByRole("button", { name: "Submit" });
}

function checkedNames(role: "radio" | "checkbox"): string[] {
  return screen
    .getAllByRole(role)
    .filter((input) => (input as HTMLInputElement).checked)
    .map((input) => input.closest("label")?.textContent ?? "");
}

describe("Question with a single-choice question", () => {
  it("offers its 4 options as a radio group named by the prompt (AC-2.1)", async () => {
    const { container } = renderQuestion(firstQuestion);

    const group = screen.getByRole("group", { name: firstQuestion.question.prompt });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["1", "2", "undefined", "It throws a ReferenceError"]);
    expect(screen.queryByText("Select all that apply")).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("keeps only one option selected (AC-2.1)", async () => {
    const { user } = renderQuestion(firstQuestion);

    await user.click(screen.getByRole("radio", { name: "1" }));
    await user.click(screen.getByRole("radio", { name: "undefined" }));

    expect(checkedNames("radio")).toEqual(["undefined"]);
  });

  it("submits the selected option", async () => {
    const { onSubmit, user } = renderQuestion(firstQuestion);

    await user.click(screen.getByRole("radio", { name: "2" }));
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["b"]);
  });
});

describe("Question with a multiple-choice question", () => {
  it('says "Select all that apply" as the description of its checkboxes (AC-2.2)', async () => {
    const { container } = renderQuestion(multipleChoiceQuestion);

    const group = screen.getByRole("group", { name: multipleChoiceQuestion.question.prompt });
    expect(screen.getByText("Select all that apply")).toBeDefined();
    expect(group.getAttribute("aria-describedby")).toBe(
      screen.getByText("Select all that apply").id,
    );
    expect(within(group).getAllByRole("checkbox")).toHaveLength(4);
    await expectNoAxeViolations(container);
  });

  it("lets several options be selected and unselected (AC-2.2)", async () => {
    const { user } = renderQuestion(multipleChoiceQuestion);

    await user.click(screen.getByRole("checkbox", { name: "A slug unique among the todos" }));
    await user.click(screen.getByRole("checkbox", { name: "Math.random()" }));
    await user.click(screen.getByRole("checkbox", { name: "todo.id" }));
    await user.click(screen.getByRole("checkbox", { name: "Math.random()" }));

    expect(checkedNames("checkbox")).toEqual(["todo.id", "A slug unique among the todos"]);
  });

  it("submits every selected option, in display order", async () => {
    const { onSubmit, user } = renderQuestion(multipleChoiceQuestion);

    await user.click(screen.getByRole("checkbox", { name: "A slug unique among the todos" }));
    await user.click(screen.getByRole("checkbox", { name: "todo.id" }));
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["a", "c"]);
  });
});

describe("Question Submit", () => {
  it.each([
    ["single", firstQuestion, "Select an answer to submit."],
    ["multiple", multipleChoiceQuestion, "Select at least one answer to submit."],
  ] as const)(
    "stays inert with a hint while no %s-choice option is selected (AC-2.3)",
    async (_kind, question, hint) => {
      const { onSubmit, user, container } = renderQuestion(question);

      const button = submitButton();
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(screen.getByText(hint).id).toBe(button.getAttribute("aria-describedby"));

      await user.click(button);
      button.focus();
      await user.keyboard("{Enter}");

      expect(onSubmit).not.toHaveBeenCalled();
      await expectNoAxeViolations(container);
    },
  );

  it("becomes available, without the hint, once an option is selected", async () => {
    const { user } = renderQuestion(firstQuestion);

    await user.click(screen.getByRole("radio", { name: "2" }));

    expect(submitButton().getAttribute("aria-disabled")).toBe("false");
    expect(submitButton().hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByText("Select an answer to submit.")).toBeNull();
  });

  it("is blocked again when every multiple-choice option is unselected", async () => {
    const { onSubmit, user } = renderQuestion(multipleChoiceQuestion);

    await user.click(screen.getByRole("checkbox", { name: "todo.id" }));
    await user.click(screen.getByRole("checkbox", { name: "todo.id" }));
    await user.click(submitButton());

    expect(submitButton().getAttribute("aria-disabled")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Question snippets", () => {
  it("shows a JavaScript snippet with syntax highlighting (AC-2.5)", async () => {
    const { container } = renderQuestion(singleChoiceWithSnippet);

    const snippet = screen.getByRole("group", { name: "Code snippet, JavaScript" });
    expect(snippet.textContent).toBe(singleChoiceWithSnippet.question.snippet.source);
    expect(within(snippet).getByText("function").className).toBe("tok-keyword");
    expect(within(snippet).getByText('"calls"').className).toBe("tok-string");
    await expectNoAxeViolations(container);
  });

  it("shows a JSX snippet with its tags highlighted (AC-2.5)", async () => {
    const { container } = renderQuestion(multipleChoiceQuestion);

    const snippet = screen.getByRole("group", { name: "Code snippet, JSX" });
    expect(snippet.textContent).toBe(multipleChoiceQuestion.question.snippet.source);
    expect(within(snippet).getAllByText("li")[0]?.classList.contains("tok-tagName")).toBe(true);
    await expectNoAxeViolations(container);
  });

  it("shows no snippet when the question has none", () => {
    renderQuestion(firstQuestion);

    expect(screen.queryByRole("group", { name: /Code snippet/ })).toBeNull();
  });
});

describe("Question with the keyboard only (NFR-2)", () => {
  it("answers a single-choice question with Tab, the arrow keys and Enter", async () => {
    const { onSubmit, user } = renderQuestion(singleChoiceWithSnippet);

    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Code snippet, JavaScript" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1" }));
    await user.keyboard("{ArrowDown}");
    expect(checkedNames("radio")).toEqual(["2"]);
    await user.tab();
    expect(document.activeElement).toBe(submitButton());
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["b"]);
  });

  it("answers a multiple-choice question with Tab, Space and Enter", async () => {
    const { onSubmit, user } = renderQuestion(multipleChoiceQuestion);

    await user.tab(); // the snippet
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "todo.id" }));
    await user.keyboard(" ");
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("checkbox", { name: "A slug unique among the todos" }),
    );
    await user.keyboard(" ");
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(submitButton());
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["a", "c"]);
  });
});
