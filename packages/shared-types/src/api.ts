import { z } from "zod";

import { CodeExercise, Question } from "./questions.js";
import { SessionState } from "./session.js";
import { ConceptId, isConceptOfTopic, Level, Position, SESSION_LENGTH, TopicId } from "./topics.js";

/** `POST /api/quiz/next-question` body: a session that still has a question to come. */
export const NextQuestionRequest = z.object({
  state: SessionState.refine((state) => state.answers.length < SESSION_LENGTH, {
    message: "The session is already complete",
    path: ["answers"],
  }),
});
export type NextQuestionRequest = z.infer<typeof NextQuestionRequest>;

/** `POST /api/quiz/next-question` response (plan §7.1). */
export const NextQuestionResponse = z.object({
  position: Position,
  level: Level,
  conceptId: ConceptId,
  conceptLabel: z.string().min(1).max(100),
  question: Question,
});
export type NextQuestionResponse = z.infer<typeof NextQuestionResponse>;

/** Maximum length of the code a visitor submits for review. */
export const SUBMITTED_CODE_MAX_LENGTH = 5_000;

/** `POST /api/quiz/code-review` body (plan §7.2). */
export const CodeReviewRequest = z
  .object({
    topic: TopicId,
    conceptId: ConceptId,
    level: Level,
    exercise: CodeExercise,
    code: z.string().max(SUBMITTED_CODE_MAX_LENGTH),
  })
  .superRefine((request, ctx) => {
    if (!isConceptOfTopic(request.topic, request.conceptId)) {
      ctx.addIssue({
        code: "custom",
        path: ["conceptId"],
        message: `Concept "${request.conceptId}" does not belong to topic "${request.topic}"`,
      });
    }
  });
export type CodeReviewRequest = z.infer<typeof CodeReviewRequest>;

export const ReviewAspect = z.enum(["correctness", "readability", "idiomatic"]);
export type ReviewAspect = z.infer<typeof ReviewAspect>;

export const ReviewComment = z.object({
  aspect: ReviewAspect,
  text: z.string().min(1).max(300),
});
export type ReviewComment = z.infer<typeof ReviewComment>;

/**
 * The AI review of a submission. It has no verdict field on purpose: only the
 * tests decide whether code is correct (AC-6.3).
 */
export const CodeReview = z.object({
  summary: z.string().min(1).max(300),
  comments: z.array(ReviewComment).min(1).max(5),
});
export type CodeReview = z.infer<typeof CodeReview>;

/** `POST /api/quiz/code-review` response (plan §7.2). */
export const CodeReviewResponse = z.object({ review: CodeReview });
export type CodeReviewResponse = z.infer<typeof CodeReviewResponse>;
