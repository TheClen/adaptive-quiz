import { expect, test } from "@playwright/test";

import { javascript } from "./fixtures/javascript.js";
import { expectNoAxeViolations } from "./support/axe.js";
import { errorResponse, mockQuizApi } from "./support/mockApi.js";

/**
 * The screens a session only shows when the API is slow or fails. The session
 * tests scan every other screen.
 */

test("the loading screen has no axe violations", async ({ page }) => {
  await mockQuizApi(page, javascript);
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Holds the first question back, then hands it on to the mock.
  await page.route(
    "**/api/quiz/next-question",
    async (route) => {
      await released;
      await route.fallback();
    },
    { times: 1 },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "JavaScript" }).click();
  await expect(page.getByRole("status")).toHaveText("Preparing your question…");
  await expectNoAxeViolations(page, "loading");

  release();
  await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
});

test("the error screen has no axe violations, and Retry recovers", async ({ page }) => {
  const api = await mockQuizApi(page, javascript);
  await page.route(
    "**/api/quiz/next-question",
    (route) => route.fulfill(errorResponse(503, "ai_unavailable")),
    { times: 1 },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "JavaScript" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expectNoAxeViolations(page, "error");

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
  expect(api.problems).toEqual([]);
});
