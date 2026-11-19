import { MAX_LEVEL } from "@ai-in-learning/core";
import { SESSION_LENGTH } from "@ai-in-learning/shared-types";

import { APP_NAME } from "../app/appName.js";
import type { SessionProgress } from "../app/sessionReducer.js";
import { TOPIC_LABELS } from "../app/topics.js";
import styles from "./SessionHeader.module.css";

/**
 * The banner shown on every screen of a session: topic, "Question n of 10" and
 * "Level n/5" (AC-1.3).
 */
export function SessionHeader({ progress }: { readonly progress: SessionProgress }) {
  return (
    <header className={styles.header}>
      <p className={styles.appName}>{APP_NAME}</p>
      <ul className={styles.progress} aria-label="Session progress">
        <li className={styles.topic}>{TOPIC_LABELS[progress.topic]}</li>
        <li>
          Question {progress.position} of {SESSION_LENGTH}
        </li>
        <li>
          Level {progress.level}/{MAX_LEVEL}
        </li>
      </ul>
    </header>
  );
}
