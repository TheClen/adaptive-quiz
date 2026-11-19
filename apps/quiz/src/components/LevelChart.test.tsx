import type { Level } from "@ai-in-learning/shared-types";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "../testing/axe.js";
import { LevelChart, levelChartDescription } from "./LevelChart.js";

const history: Level[] = [3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3];

describe("levelChartDescription", () => {
  it("lists every level in order (plan §13.3)", () => {
    expect(levelChartDescription([3, 4, 5, 4])).toBe("Level: 3, 4, 5, 4");
  });
});

describe("LevelChart", () => {
  it("is an image named by its text alternative, inside a captioned figure (AC-7.1)", async () => {
    const { container } = render(<LevelChart history={history} />);

    expect(screen.getByRole("figure", { name: "Your level after each question" })).toBeDefined();
    const chart = screen.getByRole("img", { name: "Level: 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3" });
    // One point per value, the final level labelled.
    expect(chart.querySelectorAll("circle")).toHaveLength(11);
    expect(chart.textContent).toContain("3/5");
    await expectNoAxeViolations(container);
  });

  it("holds the same values in a table for screen readers (plan §13.3)", () => {
    const { container } = render(<LevelChart history={history} />);

    const table = screen.getByRole("table", { name: "Level after each question" });
    expect(table.classList.contains("visually-hidden")).toBe(true);
    const rows = within(table)
      .getAllByRole("row")
      .map((row) => Array.from(row.children, (cell) => cell.textContent));
    expect(rows[0]).toEqual(["Question", "Level"]);
    expect(rows.slice(1)).toEqual([
      ["Start", "3"],
      ...history.slice(1).map((level, index) => [String(index + 1), String(level)]),
    ]);
    expect(container.querySelector("svg")?.getAttribute("role")).toBe("img");
  });
});
