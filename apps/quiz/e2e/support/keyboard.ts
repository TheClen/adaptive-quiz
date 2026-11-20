import { expect, type Locator, type Page } from "@playwright/test";

/** Presses Tab at most this many times to reach an element. */
const MAX_TABS = 40;

async function isFocused(target: Locator): Promise<boolean> {
  return target.evaluate((element) => element === document.activeElement);
}

/**
 * Presses Tab until `target` has focus, the way a keyboard user reaches it. Fails
 * if it is not reached, for example when focus is trapped.
 */
export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < MAX_TABS && !(await isFocused(target)); presses++) {
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** Reaches a button with Tab and presses Enter on it. */
export async function pressButton(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name, exact: true });
  await tabTo(page, button);
  await page.keyboard.press("Enter");
}

/**
 * Selects one radio option: Tab enters the group on its first option, Space checks
 * it, and the arrow keys move to and check the next ones.
 */
export async function chooseRadio(page: Page, text: string): Promise<void> {
  const target = page.getByRole("radio", { name: text, exact: true });
  await tabTo(page, page.getByRole("radio").first());
  await page.keyboard.press("Space");
  for (let presses = 0; presses < 6 && !(await isFocused(target)); presses++) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(target).toBeChecked();
}

/** Checks each checkbox with Tab and Space. `texts` must be in display order. */
export async function checkBoxes(page: Page, texts: readonly string[]): Promise<void> {
  for (const text of texts) {
    const target = page.getByRole("checkbox", { name: text, exact: true });
    await tabTo(page, target);
    await page.keyboard.press("Space");
    await expect(target).toBeChecked();
  }
}

/** The editable code editor of an exercise. */
export function codeEditor(page: Page): Locator {
  return page.getByRole("textbox", { name: "Your solution" });
}

/**
 * Replaces the code in the focused editor, typed key by key. Enter inserts a new
 * line with the editor's own indentation, which leaves the code valid.
 */
export async function replaceCode(page: Page, code: string): Promise<void> {
  await expect(codeEditor(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(code);
}

/** Leaves the editor the way its hint says: Escape, then Tab (NFR-2). */
export async function leaveEditor(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
}
