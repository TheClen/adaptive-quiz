import { QuestionKind, SESSION_LENGTH } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { KIND_SCHEDULE, kindAt, nextKind, nextPosition } from "./schedule.js";

describe("kind schedule", () => {
  it("has one entry per question of the session", () => {
    expect(KIND_SCHEDULE).toHaveLength(10);
    expect(KIND_SCHEDULE).toHaveLength(SESSION_LENGTH);
  });

  it("places code exercises at positions 4 and 8 only", () => {
    const codePositions = KIND_SCHEDULE.flatMap((kind, index) =>
      kind === "code" ? [index + 1] : [],
    );
    expect(codePositions).toEqual([4, 8]);
  });

  it("matches plan §6.2", () => {
    expect(KIND_SCHEDULE).toEqual([
      "single",
      "multiple",
      "single",
      "code",
      "single",
      "multiple",
      "single",
      "code",
      "multiple",
      "single",
    ]);
  });

  it("uses only valid question kinds", () => {
    for (const kind of KIND_SCHEDULE) {
      expect(QuestionKind.safeParse(kind).success).toBe(true);
    }
  });
});

describe("kindAt", () => {
  it("gives the kind of each position from the schedule", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(kindAt)).toEqual([...KIND_SCHEDULE]);
  });

  it("rejects a position outside 1 to 10", () => {
    expect(() => kindAt(0)).toThrow(RangeError);
    expect(() => kindAt(11)).toThrow(RangeError);
  });
});

describe("nextPosition and nextKind", () => {
  const answers = (count: number) => Array.from({ length: count }, () => ({}));

  it("starts at position 1 with a single-choice question", () => {
    expect(nextPosition([])).toBe(1);
    expect(nextKind([])).toBe("single");
  });

  it("is one more than the number of answers, with the scheduled kind", () => {
    for (let count = 0; count < SESSION_LENGTH; count++) {
      expect(nextPosition(answers(count))).toBe(count + 1);
      expect(nextKind(answers(count))).toBe(KIND_SCHEDULE[count]);
    }
  });

  it("throws once the session is complete", () => {
    expect(() => nextPosition(answers(10))).toThrow(RangeError);
    expect(() => nextKind(answers(10))).toThrow(RangeError);
  });
});
