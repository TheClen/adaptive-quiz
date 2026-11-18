import { QuestionKind, SESSION_LENGTH } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { KIND_SCHEDULE } from "./schedule.js";

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
