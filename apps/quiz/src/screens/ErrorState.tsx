import type { RequestFailure } from "../api/client.js";
import { errorContent } from "../app/errorMessages.js";
import buttons from "../styles/button.module.css";
import styles from "./ErrorState.module.css";
import screen from "./Screen.module.css";

/**
 * The error screen: the catalogue message for the failure, never upstream text
 * (AC-8.4), with Retry when retrying can help (AC-8.1) and a way home otherwise.
 */
export function ErrorState({
  failure,
  onRetry,
  onHome,
}: {
  readonly failure: RequestFailure;
  readonly onRetry: () => void;
  readonly onHome: () => void;
}) {
  const content = errorContent(failure);
  return (
    <section className={screen.screen} aria-labelledby="error-title">
      <h1 id="error-title" className={screen.title} tabIndex={-1}>
        {content.title}
      </h1>
      <p className={styles.message} role="alert">
        {content.message}
      </p>
      <button
        type="button"
        className={buttons.primary}
        onClick={content.action === "retry" ? onRetry : onHome}
      >
        {content.actionLabel}
      </button>
    </section>
  );
}
