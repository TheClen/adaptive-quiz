import type { Level } from "@ai-in-learning/shared-types";

/** The difficulty rubric, one line per level from 1 to 5 (plan §8.3). */
export const DIFFICULTY_RUBRIC = [
  "basic syntax and behaviour",
  "common usage",
  "typical pitfalls",
  "edge cases and interactions between features",
  "subtle semantics, performance and design trade-offs",
] as const;

/** The rubric line of `level`. Throws a `RangeError` outside 1 to 5. */
export function rubricLine(level: Level): string {
  const line = Number.isInteger(level) ? DIFFICULTY_RUBRIC[level - 1] : undefined;
  if (line === undefined) {
    throw new RangeError(`Level must be an integer from 1 to 5, got ${String(level)}`);
  }
  return line;
}
