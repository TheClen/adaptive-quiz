import { type Concept, MAX_LEVEL, summarize } from "@ai-in-learning/core";
import { SESSION_LENGTH, type SessionState, type TopicId } from "@ai-in-learning/shared-types";

import { otherTopic, TOPIC_LABELS } from "../app/topics.js";
import { LevelChart } from "../components/LevelChart.js";
import { VerdictIcon } from "../components/VerdictIcon.js";
import buttons from "../styles/button.module.css";
import screen from "./Screen.module.css";
import styles from "./Summary.module.css";

/**
 * The summary of a complete session: score, final level and level chart
 * (AC-7.1), concepts mastered and to review (AC-7.2), and a new session on the
 * same topic or the other one (AC-7.3). Everything is computed from the answers
 * with `core`, so the summary sends no request (NFR-3).
 */
export function Summary({
  session,
  onStart,
}: {
  /** A complete session: {@link SESSION_LENGTH} answers. */
  readonly session: SessionState;
  /** Starts a new session on `topic`. */
  readonly onStart: (topic: TopicId) => void;
}) {
  const { topic } = session;
  const summary = summarize(topic, session.answers);
  const other = otherTopic(topic);

  return (
    <section className={screen.screen} aria-labelledby="summary-title">
      <p className={screen.muted}>{TOPIC_LABELS[topic]} quiz complete</p>
      <h1 id="summary-title" className={screen.title} tabIndex={-1}>
        {summary.score} out of {SESSION_LENGTH} correct
      </h1>
      <p className={screen.lead}>
        You finished at level {summary.finalLevel}/{MAX_LEVEL}.
      </p>

      <LevelChart history={summary.levelHistory} />

      <div className={styles.concepts}>
        <ConceptList
          id="mastered-title"
          title="Concepts mastered"
          correct
          concepts={summary.mastered}
          empty="None this time. Every concept is in the list to review."
        />
        <ConceptList
          id="to-review-title"
          title="Concepts to review"
          correct={false}
          concepts={summary.toReview}
          empty="Nothing to review: your latest answer on every concept was correct."
        />
      </div>

      <h2 className={styles.heading}>Start a new quiz</h2>
      <div className={styles.actions}>
        <button
          type="button"
          className={buttons.primary}
          onClick={() => {
            onStart(topic);
          }}
        >
          {TOPIC_LABELS[topic]} again
        </button>
        <button
          type="button"
          className={buttons.secondary}
          onClick={() => {
            onStart(other);
          }}
        >
          Switch to {TOPIC_LABELS[other]}
        </button>
      </div>
    </section>
  );
}

/** One list of concepts, with its heading, or a sentence when it is empty. */
function ConceptList({
  id,
  title,
  correct,
  concepts,
  empty,
}: {
  readonly id: string;
  readonly title: string;
  /** Mastered concepts get a check mark, concepts to review a cross; the heading says which. */
  readonly correct: boolean;
  readonly concepts: readonly Concept[];
  readonly empty: string;
}) {
  return (
    <section className={styles.list} aria-labelledby={id} data-correct={correct}>
      <h2 id={id} className={styles.listTitle}>
        <VerdictIcon correct={correct} className={styles.listIcon} />
        {title}
      </h2>
      {concepts.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.items}>
          {concepts.map((concept) => (
            <li key={concept.id}>{concept.label}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
