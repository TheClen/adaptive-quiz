import type { CodeExercise, CodeReviewRequest, TopicId } from "@ai-in-learning/shared-types";

import type { Runner } from "../../runner/index.js";
import { signExercise } from "../exercise-token.js";
import { checkCodeDraft } from "../generation/code-rules.js";
import type { CodeExerciseDraft } from "../generation/drafts.js";
import type { ModelClient } from "../model-client.js";
import type { CodeReviewDraft } from "../review/draft.js";
import type { ReviewContext } from "../review/review-code.js";
import {
  TEST_SIGNING_SECRET,
  testRunner,
  validJavaScriptCodeDraft,
  validReactCodeDraft,
} from "./code-drafts.js";

/** A review context around `model`, with the test runner and secret. */
export function reviewContext(model: ModelClient, runner: Runner = testRunner): ReviewContext {
  return { model, runner, signingSecret: TEST_SIGNING_SECRET };
}

/** A valid review draft: a summary and one comment per aspect. */
export const validCodeReviewDraft = {
  summary: "The function groups the items correctly, in one pass over the list.",
  comments: [
    { aspect: "correctness", text: "Every test passes, including the empty list." },
    { aspect: "readability", text: "`groups` and `value` say what they hold." },
    {
      aspect: "idiomatic",
      text: "`??=` creates each group on first use without a separate check.",
    },
  ],
} satisfies CodeReviewDraft;

/** The code exercise of a valid draft, signed with `TEST_SIGNING_SECRET`. */
export async function signedExercise(draft: CodeExerciseDraft): Promise<CodeExercise> {
  const checked = checkCodeDraft(draft, []);
  if (!checked.ok) throw new Error(`Invalid test draft: ${checked.reason.rule}`);
  return signExercise(TEST_SIGNING_SECRET, {
    kind: "code",
    prompt: draft.prompt,
    functionName: draft.functionName,
    starterCode: draft.starterCode,
    tests: checked.tests,
    referenceSolution: draft.referenceSolution,
    explanation: draft.explanation,
  });
}

const REVIEWED = {
  javascript: { conceptId: "array-methods", draft: validJavaScriptCodeDraft },
  react: { conceptId: "reducers", draft: validReactCodeDraft },
} as const satisfies Record<TopicId, { conceptId: string; draft: CodeExerciseDraft }>;

/**
 * A valid review request on `topic`, with a signed exercise. The submitted code
 * defaults to the reference solution, so every test passes.
 */
export async function reviewRequest(topic: TopicId, code?: string): Promise<CodeReviewRequest> {
  const { conceptId, draft } = REVIEWED[topic];
  return {
    topic,
    conceptId,
    level: 3,
    exercise: await signedExercise(draft),
    code: code ?? draft.referenceSolution,
  };
}
