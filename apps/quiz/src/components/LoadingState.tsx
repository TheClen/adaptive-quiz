import styles from "./LoadingState.module.css";

/**
 * The loading screen of a step that waits for the AI. It appears in the render
 * that follows the click (NFR-1) and is announced as a status (plan §13.3).
 */
export function LoadingState({ message }: { readonly message: string }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <h1 className={styles.title} tabIndex={-1}>
        {message}
      </h1>
    </div>
  );
}
