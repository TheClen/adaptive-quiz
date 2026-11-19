import { useId } from "react";

import button from "../styles/button.module.css";
import styles from "./SubmitButton.module.css";

/**
 * The submit button of a question. While `blocked`, it stays focusable but inert:
 * `aria-disabled` with a visible hint, rather than a `disabled` button that
 * keyboard and screen reader users cannot find (AC-2.3, plan §13.3). The form's
 * submit handler ignores submissions while blocked.
 */
export function SubmitButton({
  blocked,
  hint,
}: {
  readonly blocked: boolean;
  /** Why the button is blocked, shown while it is. */
  readonly hint: string;
}) {
  const hintId = useId();
  return (
    <div className={styles.submit}>
      <button
        type="submit"
        className={button.primary}
        aria-disabled={blocked}
        {...(blocked ? { "aria-describedby": hintId } : {})}
      >
        Submit
      </button>
      {blocked ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
