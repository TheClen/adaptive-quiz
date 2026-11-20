import { expect, type Page, test } from "@playwright/test";

import { javascript } from "./fixtures/javascript.js";
import { react } from "./fixtures/react.js";
import type { QuestionFixture, QuizFixture } from "./fixtures/types.js";
import { expectNoAxeViolations } from "./support/axe.js";
import {
  checkBoxes,
  chooseRadio,
  codeEditor,
  leaveEditor,
  pressButton,
  replaceCode,
  tabTo,
} from "./support/keyboard.js";
import { mockQuizApi } from "./support/mockApi.js";

const TOPIC_LABELS = { javascript: "JavaScript", react: "React" } as const;

/**
 * The positions answered wrongly: a choice question and the second exercise,
 * submitted with its starter code. The level then goes 3, 4, 5, 4, 5, 5, 5, 5, 4,
 * 5, 5.
 */
const WRONG_POSITIONS = new Set([3, 8]);

/** The heading every new screen moves focus to (plan §13.3). */
function screenHeading(page: Page, name: string | RegExp) {
  return page.getByRole("heading", { level: 1, name });
}

/** Answers a choice question with the keyboard: correctly, or with its first wrong option. */
async function answerChoice(page: Page, entry: QuestionFixture, correct: boolean): Promise<void> {
  const content = entry.question;
  if (content.kind === "single") {
    const option = content.options.find(
      (candidate) => (candidate.id === content.correctOptionId) === correct,
    );
    await chooseRadio(page, option?.text ?? "");
  } else if (content.kind === "multiple") {
    const correctIds = new Set(content.correctOptionIds);
    const chosen = content.options.filter((option) =>
      correct ? correctIds.has(option.id) : !correctIds.has(option.id),
    );
    await checkBoxes(
      page,
      chosen.map((option) => option.text),
    );
  }
  await pressButton(page, "Submit");
}

/**
 * Answers a code exercise with the keyboard (AC-3.2). Tab stays in the editor,
 * where it indents; Escape then Tab leaves it for "Run tests" (NFR-2). A correct
 * answer runs the starter code, types the reference solution and runs the tests
 * again before submitting; a wrong one submits the starter code.
 */
async function answerCode(page: Page, entry: QuestionFixture, correct: boolean): Promise<void> {
  const exercise = entry.question;
  if (exercise.kind !== "code") {
    return;
  }
  const total = exercise.tests.length;
  const runTests = page.getByRole("button", { name: "Run tests" });

  await tabTo(page, codeEditor(page));
  await page.keyboard.press("Tab");
  await expect(codeEditor(page), "Tab indents in the editor").toBeFocused();
  await leaveEditor(page);
  await expect(runTests, "Escape then Tab leaves the editor").toBeFocused();

  if (correct) {
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").getByText(/of \d+ tests? passed/)).toBeVisible();

    await page.keyboard.press("Shift+Tab");
    await replaceCode(page, exercise.referenceSolution);
    await leaveEditor(page);
    await expect(runTests).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(`All ${String(total)} tests passed`)).toBeVisible();
  }
  await pressButton(page, "Submit");
}

for (const fixture of [javascript, react] satisfies QuizFixture[]) {
  const topic = TOPIC_LABELS[fixture.topic];

  test(`a ${topic} session from home to summary, keyboard only`, async ({ page }) => {
    test.slow();
    const api = await mockQuizApi(page, fixture);

    await page.goto("/");
    await expect(screenHeading(page, "Adaptive Quiz")).toBeVisible();
    await expectNoAxeViolations(page, "home");
    await pressButton(page, topic);

    for (const [index, entry] of fixture.questions.entries()) {
      const position = index + 1;
      const correct = !WRONG_POSITIONS.has(position);
      const content = entry.question;
      const isCode = content.kind === "code";

      await expect(screenHeading(page, `Question ${String(position)}`)).toBeFocused();
      await expect(page.getByRole("list", { name: "Session progress" })).toContainText(
        `Question ${String(position)} of 10`,
      );
      if (position <= 4) {
        // One scan per question kind: single, multiple, then code.
        await expectNoAxeViolations(page, `question ${String(position)}`);
      }

      if (isCode) {
        await answerCode(page, entry, correct);
      } else {
        await answerChoice(page, entry, correct);
      }

      await expect(screenHeading(page, correct ? "Correct" : "Incorrect")).toBeFocused();
      if (content.kind === "code") {
        // The AI review arrives after the verdict, in its own panel (plan §10).
        const review = fixture.reviews[content.functionName];
        await expect(page.getByText(review?.summary ?? "")).toBeVisible();
      }
      if (position <= 4) {
        await expectNoAxeViolations(page, `feedback ${String(position)}`);
      }
      await pressButton(page, position === 10 ? "See your results" : "Next question");
    }

    await expect(screenHeading(page, "8 out of 10 correct")).toBeFocused();
    await expect(page.getByText("You finished at level 5/5.")).toBeVisible();
    const toReview = page.getByRole("region", { name: "Concepts to review" });
    for (const position of WRONG_POSITIONS) {
      await expect(toReview).toContainText(fixture.questions[position - 1]?.conceptLabel ?? "");
    }
    await expectNoAxeViolations(page, "summary");

    // NFR-3: one request per question, one review per exercise, none for the summary.
    expect(api.problems).toEqual([]);
    expect(api.questionRequests.map(({ state }) => state.answers.length)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(api.reviewRequests.map(({ exercise }) => exercise.functionName)).toEqual(
      fixture.questions.flatMap(({ question }) =>
        question.kind === "code" ? [question.functionName] : [],
      ),
    );
  });
}
