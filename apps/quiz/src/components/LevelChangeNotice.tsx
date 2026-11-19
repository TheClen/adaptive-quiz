import { type LevelChange, MAX_LEVEL } from "@ai-in-learning/core";
import type { Level } from "@ai-in-learning/shared-types";

import styles from "./LevelChangeNotice.module.css";

/** The words of a level change, for example "Level up: 4/5", or `null` without one (AC-4.4). */
export function levelChangeMessage(change: LevelChange, level: Level): string | null {
  switch (change) {
    case "up":
      return `Level up: ${String(level)}/${String(MAX_LEVEL)}`;
    case "down":
      return `Level down: ${String(level)}/${String(MAX_LEVEL)}`;
    case "none":
      return null;
  }
}

/**
 * Tells the visitor that their answer moved the level (AC-4.4), in a polite live
 * region (plan §13.3). The region is rendered even without a change, empty, so
 * the feedback screen always has the same structure.
 */
export function LevelChangeNotice({
  change,
  level,
}: {
  readonly change: LevelChange;
  /** The level after the answer. */
  readonly level: Level;
}) {
  const message = levelChangeMessage(change, level);
  return (
    <p role="status" className={message === null ? styles.empty : styles.notice}>
      {message === null ? null : (
        <>
          <span className={styles.arrow} aria-hidden="true">
            {change === "up" ? "↑" : "↓"}
          </span>
          {message}
        </>
      )}
    </p>
  );
}
