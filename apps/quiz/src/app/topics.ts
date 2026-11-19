import type { TopicId } from "@ai-in-learning/shared-types";

/** The name of each topic, as the visitor sees it. */
export const TOPIC_LABELS = {
  javascript: "JavaScript",
  react: "React",
} as const satisfies Record<TopicId, string>;

/** The topics in the order the home screen offers them. */
export const TOPICS = ["javascript", "react"] as const satisfies readonly TopicId[];
