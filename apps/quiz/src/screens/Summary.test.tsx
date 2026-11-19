import type { SessionState, TopicId } from "@ai-in-learning/shared-types";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "../testing/axe.js";
import { completeSession, perfectSession } from "../testing/fixtures.js";
import { Summary } from "./Summary.js";

function renderSummary(session: SessionState) {
  const onStart = vi.fn<(topic: TopicId) => void>();
  const user = userEvent.setup();
  const { container } = render(<Summary session={session} onStart={onStart} />);
  return { onStart, user, container };
}

/** The items of the concept list under the heading `name`, or its empty message. */
function conceptList(name: string): string[] {
  const section = screen.getByRole("region", { name });
  const list = within(section).queryByRole("list");
  return list === null
    ? [section.querySelector("p")?.textContent ?? ""]
    : within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
}

describe("Summary", () => {
  it("shows the score, the final level and the level chart (AC-7.1)", async () => {
    const { container } = renderSummary(completeSession);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("6 out of 10 correct");
    expect(screen.getByText("JavaScript quiz complete")).toBeDefined();
    expect(screen.getByText("You finished at level 5/5.")).toBeDefined();
    expect(
      screen.getByRole("img", { name: "Level: 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 5" }),
    ).toBeDefined();
    expect(screen.getByRole("table", { name: "Level after each question" })).toBeDefined();
    await expectNoAxeViolations(container);
  });

  it("lists the concepts mastered and to review by their latest attempt (AC-7.2)", () => {
    renderSummary(completeSession);

    expect(conceptList("Concepts mastered")).toEqual([
      "Closures",
      "Promises",
      "this binding",
      "Event loop",
      "Strings",
    ]);
    expect(conceptList("Concepts to review")).toEqual(["Array methods", "Maps and sets"]);
  });

  it("says so when there is nothing to review", async () => {
    const { container } = renderSummary(perfectSession);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("10 out of 10 correct");
    expect(conceptList("Concepts mastered")).toEqual(["Reducers", "Refs"]);
    expect(conceptList("Concepts to review")).toEqual([
      "Nothing to review: your latest answer on every concept was correct.",
    ]);
    await expectNoAxeViolations(container);
  });

  it("says so when no concept is mastered", () => {
    renderSummary({
      ...perfectSession,
      answers: perfectSession.answers.map((answer) => ({ ...answer, correct: false })),
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("0 out of 10 correct");
    expect(screen.getByText("You finished at level 1/5.")).toBeDefined();
    expect(conceptList("Concepts mastered")).toEqual([
      "None this time. Every concept is in the list to review.",
    ]);
    expect(conceptList("Concepts to review")).toEqual(["Reducers", "Refs"]);
  });

  it("starts a new session on the same topic (AC-7.3)", async () => {
    const { onStart, user } = renderSummary(completeSession);

    await user.click(screen.getByRole("button", { name: "JavaScript again" }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith("javascript");
  });

  it("starts a new session on the other topic (AC-7.3)", async () => {
    const { onStart, user } = renderSummary(perfectSession);

    await user.click(screen.getByRole("button", { name: "Switch to JavaScript" }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith("javascript");
  });
});
