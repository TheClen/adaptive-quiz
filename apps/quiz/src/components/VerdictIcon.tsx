/**
 * A check mark or a cross. Decorative: the verdict is always written next to it,
 * so nothing relies on the icon or its colour alone (plan §13.3).
 */
export function VerdictIcon({
  correct,
  className,
}: {
  readonly correct: boolean;
  readonly className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path
        d={correct ? "M6.5 12.5l3.5 3.5 7.5-8" : "M8 8l8 8M16 8l-8 8"}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
