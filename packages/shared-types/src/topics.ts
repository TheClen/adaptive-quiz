import { z } from "zod";

/** The two quiz topics. */
export const TopicId = z.enum(["javascript", "react"]);
export type TopicId = z.infer<typeof TopicId>;

/** Concept ids of the JavaScript topic (plan §6.3). */
export const JavaScriptConceptId = z.enum([
  "scope-and-hoisting",
  "types-and-coercion",
  "functions",
  "closures",
  "this-binding",
  "prototypes-and-classes",
  "array-methods",
  "objects-and-destructuring",
  "immutability-and-copying",
  "strings",
  "maps-and-sets",
  "error-handling",
  "promises",
  "async-await",
  "event-loop",
  "iterators-and-generators",
  "modules",
]);
export type JavaScriptConceptId = z.infer<typeof JavaScriptConceptId>;

/** Concept ids of the React topic (plan §6.3). */
export const ReactConceptId = z.enum([
  "jsx-and-rendering",
  "components-and-props",
  "state-and-immutable-updates",
  "reducers",
  "derived-state-and-selectors",
  "events-and-forms",
  "use-effect",
  "memoization",
  "refs",
  "context",
  "custom-hooks",
  "lifting-state-up",
  "rendering-behavior",
]);
export type ReactConceptId = z.infer<typeof ReactConceptId>;

/** The concept id enum of each topic. */
export const conceptIdsByTopic = {
  javascript: JavaScriptConceptId,
  react: ReactConceptId,
} as const satisfies Record<TopicId, z.ZodEnum>;

/** Any concept id, whatever its topic. Pair it with {@link isConceptOfTopic}. */
export const ConceptId = z.union([JavaScriptConceptId, ReactConceptId]);
export type ConceptId = z.infer<typeof ConceptId>;

/** True when `conceptId` belongs to `topic` (AC-5.1). */
export function isConceptOfTopic(topic: TopicId, conceptId: string): boolean {
  return conceptIdsByTopic[topic].safeParse(conceptId).success;
}

/** The three question kinds. */
export const QuestionKind = z.enum(["single", "multiple", "code"]);
export type QuestionKind = z.infer<typeof QuestionKind>;

/** Difficulty level, 1 to 5 (plan §6.1). */
export const Level = z.int().min(1).max(5);
export type Level = z.infer<typeof Level>;

/** Number of questions in a session. */
export const SESSION_LENGTH = 10;

/** Position of a question in the session, 1 to 10. */
export const Position = z.int().min(1).max(SESSION_LENGTH);
export type Position = z.infer<typeof Position>;
