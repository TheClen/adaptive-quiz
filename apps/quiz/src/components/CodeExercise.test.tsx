import type { TestResult } from "@ai-in-learning/core/runner";
import { SUBMITTED_CODE_MAX_LENGTH } from "@ai-in-learning/shared-types";
import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RunnerProvider } from "../app/RunnerContext.js";
import { expectNoAxeViolations } from "../testing/axe.js";
import { createFakeRunner } from "../testing/fakeRunner.js";
import { codeQuestion, failingResults, passingResults } from "../testing/fixtures.js";
import { READ_ONLY_HINT } from "./CodeEditor.js";
import { CodeExercise, TOO_LONG_HINT } from "./CodeExercise.js";

const exercise = codeQuestion.question;

function renderExercise(content = exercise) {
  const fakeRunner = createFakeRunner();
  const onSubmit = vi.fn<(code: string, testResults: readonly TestResult[]) => void>();
  const user = userEvent.setup();
  const { container } = render(
    <RunnerProvider runner={fakeRunner.runner}>
      <CodeExercise exercise={content} onSubmit={onSubmit} />
    </RunnerProvider>,
  );
  return { fakeRunner, onSubmit, user, container };
}

function editor(): HTMLElement {
  return screen.getByRole("textbox", { name: "Your solution" });
}

/** Places the cursor in the editor, as tabbing into it would. */
function focusEditor(): void {
  act(() => {
    editor().focus();
  });
}

function runTestsButton(): HTMLElement {
  return screen.getByRole("button", { name: "Run tests" });
}

function status(): string | null {
  return screen.getByRole("status").textContent;
}

async function settleRun(
  fakeRunner: ReturnType<typeof createFakeRunner>,
  index: number,
  results: readonly TestResult[],
) {
  await act(async () => {
    fakeRunner.runs[index]?.resolve(results);
    await Promise.resolve();
  });
}

describe("CodeExercise", () => {
  it("shows the statement, the starter code in the editor and what the tests check (AC-3.1)", async () => {
    const { container } = renderExercise();

    expect(screen.getByText(exercise.prompt)).toBeDefined();
    expect(editor().textContent).toBe(exercise.starterCode.replaceAll("\n", ""));
    expect(screen.getByRole("heading", { level: 2, name: "What the tests check" })).toBeDefined();
    expect(
      within(screen.getByRole("list"))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(exercise.tests.map((test) => test.description));
    expect(runTestsButton()).toBeDefined();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDefined();
    await expectNoAxeViolations(container);
  });

  it("runs the tests on the current code and shows the results (AC-3.2)", async () => {
    const { fakeRunner, user, container } = renderExercise();
    focusEditor();
    await user.keyboard("x");

    await user.click(runTestsButton());

    expect(fakeRunner.runs).toHaveLength(1);
    expect(fakeRunner.runs[0]?.input).toEqual({
      code: `x${exercise.starterCode}`,
      functionName: exercise.functionName,
      tests: exercise.tests,
    });
    expect(status()).toBe("Running tests…");

    await settleRun(fakeRunner, 0, failingResults);

    expect(status()).toBe("2 of 3 tests passed");
    expect(screen.getByText("Expected 0 but got undefined")).toBeDefined();
    await expectNoAxeViolations(container);
  });

  it("runs the tests as many times as the visitor wants, each run replacing the last (AC-3.2)", async () => {
    const { fakeRunner, onSubmit, user } = renderExercise();

    await user.click(runTestsButton());
    await settleRun(fakeRunner, 0, failingResults);
    await user.click(runTestsButton());
    await settleRun(fakeRunner, 1, passingResults);

    expect(fakeRunner.runs).toHaveLength(2);
    expect(status()).toBe("All 3 tests passed");
    expect(screen.queryByText("Expected 0 but got undefined")).toBeNull();
    expect(editor().getAttribute("aria-readonly")).not.toBe("true");

    await user.click(runTestsButton());
    expect(fakeRunner.runs).toHaveLength(3);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps Run tests inert while a run is in progress", async () => {
    const { fakeRunner, user } = renderExercise();

    await user.click(runTestsButton());
    expect(runTestsButton().getAttribute("aria-disabled")).toBe("true");
    await user.click(runTestsButton());

    expect(fakeRunner.runs).toHaveLength(1);
    await settleRun(fakeRunner, 0, passingResults);
    expect(runTestsButton().getAttribute("aria-disabled")).toBe("false");
  });

  it("on Submit freezes the editor, runs the tests once more and records their results (AC-3.3)", async () => {
    const { fakeRunner, onSubmit, user } = renderExercise();
    focusEditor();
    await user.keyboard("x");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(editor().getAttribute("aria-readonly")).toBe("true");
    expect(screen.getByText(READ_ONLY_HINT)).toBeDefined();
    expect(status()).toBe("Running tests…");
    expect(fakeRunner.runs[0]?.input.code).toBe(`x${exercise.starterCode}`);
    // The frozen code cannot change while the final run is in progress.
    focusEditor();
    await user.keyboard("y");
    await user.click(runTestsButton());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(fakeRunner.runs).toHaveLength(1);
    expect(onSubmit).not.toHaveBeenCalled();

    await settleRun(fakeRunner, 0, failingResults);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(`x${exercise.starterCode}`, failingResults);
  });

  it("submits with the results of the final run, not of an earlier one (AC-3.3)", async () => {
    const { fakeRunner, onSubmit, user } = renderExercise();

    await user.click(runTestsButton());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await settleRun(fakeRunner, 0, passingResults);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(status()).toBe("Running tests…");

    await settleRun(fakeRunner, 1, failingResults);

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(exercise.starterCode, failingResults);
  });

  it("blocks Submit, with a hint, while the code is longer than the API accepts", async () => {
    const tooLong = `// ${"x".repeat(SUBMITTED_CODE_MAX_LENGTH)}`;
    const { fakeRunner, onSubmit, user, container } = renderExercise({
      ...exercise,
      starterCode: tooLong,
    });
    const submit = screen.getByRole("button", { name: "Submit" });

    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(TOO_LONG_HINT)).toBeDefined();
    await user.click(submit);

    expect(fakeRunner.runs).toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });
});
