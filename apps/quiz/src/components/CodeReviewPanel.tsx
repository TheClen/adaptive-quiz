import type { ReviewAspect } from "@ai-in-learning/shared-types";
import { useId } from "react";

import type { ReviewStatus } from "../app/sessionReducer.js";
import buttons from "../styles/button.module.css";
import styles from "./CodeReviewPanel.module.css";

export const REVIEW_LOADING = "Reviewing your code…";
export const REVIEW_UNAVAILABLE = "The AI review is unavailable.";
export const REVIEW_NOTICE = "Written by AI. Only the tests decide whether your answer is correct.";

const ASPECT_LABELS = {
  correctness: "Correctness",
  readability: "Readability",
  idiomatic: "Idiomatic use",
} as const satisfies Record<ReviewAspect, string>;

/**
 * The AI review of a submission (AC-6.2), with its own loading and error states
 * so that it never holds up the rest of the feedback (plan §10). It shows no
 * verdict: the verdict comes from the tests only (AC-6.3).
 *
 * The review is announced in a polite live region when it arrives. Retry sits
 * outside the region, so it is not read out with the message.
 */
export function CodeReviewPanel({
  review,
  onRetry,
}: {
  readonly review: ReviewStatus;
  /** Requests the review again after a failure. */
  readonly onRetry: () => void;
}) {
  const headingId = useId();
  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        AI review
      </h2>
      <div aria-live="polite">
        {review.status === "pending" ? (
          <p className={styles.loading}>
            <span className={styles.spinner} aria-hidden="true" />
            {REVIEW_LOADING}
          </p>
        ) : null}
        {review.status === "failed" ? <p className={styles.message}>{REVIEW_UNAVAILABLE}</p> : null}
        {review.status === "ready" ? (
          <>
            <p className={styles.summary}>{review.review.summary}</p>
            <ul className={styles.comments}>
              {review.review.comments.map((comment, index) => (
                <li key={index} className={styles.comment}>
                  <span className={styles.aspect}>{ASPECT_LABELS[comment.aspect]}</span>
                  <span>{comment.text}</span>
                </li>
              ))}
            </ul>
            <p className={styles.notice}>{REVIEW_NOTICE}</p>
          </>
        ) : null}
      </div>
      {review.status === "failed" ? (
        <button type="button" className={buttons.secondary} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </section>
  );
}
