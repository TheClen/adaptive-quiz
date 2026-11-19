import type { TopicId } from "@ai-in-learning/shared-types";

/** The name of each topic, as the visitor sees it. */
export const TOPIC_LABELS = {
  javascript: "JavaScript",
  react: "React",
} as const satisfies Record<TopicId, string>;

/** The topics in the order the home screen offers them. */
export const TOPICS = ["javascript", "react"] as const satisfies readonly TopicId[];

/** The topic a visitor can switch to from the summary (AC-7.3). */
export function otherTopic(topic: TopicId): TopicId {
  return topic === "javascript" ? "react" : "javascript";
}
