import { ReviewAspect } from "@ai-in-learning/shared-types";
import { z } from "zod";

/**
 * What the model returns for a code review, before the server checks it (plan §10).
 *
 * As for question drafts, the schema checks structure only: the summary and comment
 * lengths and the comment count are checked by `CodeReview` in `reviewCode`. Like
 * `CodeReview`, it has no verdict field, so the model cannot return one (AC-6.3).
 */
export const CodeReviewDraft = z.object({
  summary: z.string().min(1),
  comments: z.array(
    z.object({
      aspect: ReviewAspect,
      text: z.string().min(1),
    }),
  ),
});
export type CodeReviewDraft = z.infer<typeof CodeReviewDraft>;
