import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Scans the whole page with axe, every rule enabled, and fails with a readable list
 * of violations (NFR-2). Unlike the jsdom scans of the component tests, this one
 * renders, so it also checks colour contrast.
 */
export async function expectNoAxeViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`,
  );
  expect(violations, `axe violations on the ${screen} screen`).toEqual([]);
}
