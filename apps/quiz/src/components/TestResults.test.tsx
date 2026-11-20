import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "../testing/axe.js";
import { codeQuestion, failingResults, passingResults } from "../testing/fixtures.js";
import { TestResults, testSummary } from "./TestResults.js";

const { tests } = codeQuestion.question;

/** The text of each test row, in order. */
function rows(): string[] {
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("testSummary", () => {
  it("counts the passed tests", () => {
    expect(testSummary(passingResults)).toBe("All 3 tests passed");
    expect(testSummary(failingResults)).toBe("2 of 3 tests passed");
    expect(testSummary([{ testId: "t1", passed: true }])).toBe("The test passed");
    expect(testSummary([{ testId: "t1", passed: false, reason: "No function" }])).toBe(
      "0 of 1 test passed",
    );
  });
});

describe("TestResults", () => {
  it("lists what each test checks before any run, with an empty live region (AC-3.1)", async () => {
    const { container } = render(<TestResults tests={tests} results={null} />);

    expect(rows()).toEqual(tests.map((test) => test.description));
    expect(screen.getByRole("status").textContent).toBe("");
    await expectNoAxeViolations(container);
  });

  it("marks each test passed or failed in words, with the reason of a failure (AC-3.2)", async () => {
    const { container } = render(<TestResults tests={tests} results={failingResults} />);

    expect(rows()).toEqual([
      "Sums three numbersPassed",
      "Returns 0 for an empty arrayFailedExpected 0 but got undefined",
      "Does not change its inputPassed",
    ]);
    expect(screen.getByRole("status").textContent).toBe("2 of 3 tests passed");
    await expectNoAxeViolations(container);
  });

  it("announces a run in progress and keeps the previous results until it ends", () => {
    render(<TestResults tests={tests} results={passingResults} running />);

    expect(screen.getByRole("status").textContent).toBe("Running tests…");
    expect(rows()[0]).toBe("Sums three numbersPassed");
  });
});
