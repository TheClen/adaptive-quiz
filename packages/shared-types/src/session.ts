import { z } from "zod";

import { ConceptId, isConceptOfTopic, QuestionKind, SESSION_LENGTH, TopicId } from "./topics.js";

/** Maximum length of a stored question stem, used to avoid repeats. */
export const STEM_MAX_LENGTH = 300;

/** One answered question, as the client records it (plan §5). */
export const AnsweredQuestion = z.object({
  kind: QuestionKind,
  conceptId: ConceptId,
  correct: z.boolean(),
  stem: z.string().min(1).max(STEM_MAX_LENGTH),
});
export type AnsweredQuestion = z.infer<typeof AnsweredQuestion>;

/**
 * The whole session, held by the client and sent with each request (principle V).
 *
 * The schema checks shape and that every concept belongs to the topic. Whether the
 * answers follow the kind schedule is checked in `core` (`checkSessionState`).
 */
export const SessionState = z
  .object({
    version: z.literal(1),
    topic: TopicId,
    seed: z.int().min(0).max(0xffff_ffff),
    answers: z.array(AnsweredQuestion).max(SESSION_LENGTH),
  })
  .superRefine((state, ctx) => {
    state.answers.forEach((answer, index) => {
      if (!isConceptOfTopic(state.topic, answer.conceptId)) {
        ctx.addIssue({
          code: "custom",
          path: ["answers", index, "conceptId"],
          message: `Concept "${answer.conceptId}" does not belong to topic "${state.topic}"`,
        });
      }
    });
  });
export type SessionState = z.infer<typeof SessionState>;
