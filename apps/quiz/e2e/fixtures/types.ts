import type { CodeReview, NextQuestionResponse, TopicId } from "@ai-in-learning/shared-types";

/**
 * A question as the API returns it, without the two fields the API derives from the
 * session: `position` and `level`. The mock adds them from each request, as the
 * server does (AC-4.5).
 */
export type QuestionFixture = Omit<NextQuestionResponse, "position" | "level">;

/** The API responses of one session, replayed by the mocked API (plan §16.1). */
export interface QuizFixture {
  readonly topic: TopicId;
  /** Question n of the session at index n - 1, following the kind schedule (plan §6.2). */
  readonly questions: readonly QuestionFixture[];
  /** The review of each code exercise, by its function name. */
  readonly reviews: Readonly<Record<string, CodeReview>>;
}
