import { expect, type Page, test } from "@playwright/test";

import { countVowelsExercise, javascript } from "./fixtures/javascript.js";
import { codeEditor, replaceCode } from "./support/keyboard.js";
import { mockQuizApi } from "./support/mockApi.js";

/**
 * These tests run visitor code in the real runner worker, on the QuickJS
 * WebAssembly module of the built app (plan §9.2). To reach an exercise at once,
 * the mocked API returns one as the first question.
 */
async function openExercise(page: Page): Promise<void> {
  const api = await mockQuizApi(page, { ...javascript, questions: [countVowelsExercise] });
  await page.goto("/");
  await page.getByRole("button", { name: "JavaScript" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
  await codeEditor(page).click();
  expect(api.problems).toEqual([]);
}

const SOLUTION =
  'function countVowels(text) { return [...text.toLowerCase()].filter((c) => "aeiou".includes(c)).length; }';

test("an infinite loop stops with the timeout message while the page stays interactive (AC-3.4)", async ({
  page,
}) => {
  await openExercise(page);
  await replaceCode(page, "function countVowels(text) { while (true) {} }");
  await page.getByRole("button", { name: "Run tests" }).click();
  const results = page.getByRole("status");
  await expect(results).toHaveText("Running tests…");

  // The loop runs in the worker, so the page still handles input meanwhile.
  await codeEditor(page).press("End");
  await codeEditor(page).pressSequentially(" // still typing");
  await expect(codeEditor(page)).toContainText("// still typing");
  await expect(results, "the typing happened during the run").toHaveText("Running tests…");

  await expect(results).toHaveText("0 of 3 tests passed", { timeout: 10_000 });
  await expect(
    page.getByText("Stopped after 3 seconds: the code may contain an infinite loop"),
  ).toHaveCount(3);

  // The runner recovers: the next run gives real results.
  await codeEditor(page).click();
  await replaceCode(page, SOLUTION);
  await page.getByRole("button", { name: "Run tests" }).click();
  await expect(results).toHaveText("All 3 tests passed");
});

test("code reading document.title fails inside the exercise (AC-3.5)", async ({ page }) => {
  await openExercise(page);
  await replaceCode(page, "function countVowels(text) { return document.title.length; }");
  await page.getByRole("button", { name: "Run tests" }).click();

  await expect(page.getByRole("status")).toHaveText("0 of 3 tests passed");
  await expect(page.getByText(/^Threw ReferenceError/)).toHaveCount(3);
});
