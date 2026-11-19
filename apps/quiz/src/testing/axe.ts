import { expect } from "vitest";
import { configureAxe } from "vitest-axe";

/**
 * axe for jsdom. jsdom does not render, so colour contrast cannot be computed
 * there: that rule runs in a real browser with the Playwright axe scans (T27).
 */
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

/** Fails with a readable list when axe finds accessibility violations (NFR-2). */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`,
  );
  expect(violations).toEqual([]);
}
