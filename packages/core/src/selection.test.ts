import {
  type AnsweredQuestion,
  type ConceptId,
  SESSION_LENGTH,
  TopicId,
} from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { conceptsOf, findConcept } from "./catalogue.js";
import { mulberry32 } from "./random.js";
import { KIND_SCHEDULE, nextKind } from "./schedule.js";
import { checkSessionState } from "./session-state.js";
import { MAX_APPEARANCES, selectNextConcept } from "./selection.js";

/** Answers following the kind schedule, one row per question. */
function session(rows: readonly (readonly [conceptId: ConceptId, correct: boolean])[]) {
  return rows.map(([conceptId, correct], index) => ({
    kind: KIND_SCHEDULE[index] ?? "single",
    conceptId,
    correct,
    stem: `Question ${String(index + 1)} on ${conceptId}`,
  }));
}

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 7_919);

describe("selectNextConcept: missed concepts come back (AC-5.2)", () => {
  it("serves a missed concept at the next position", () => {
    const next = selectNextConcept("javascript", 1, session([["closures", false]]));
    expect(next.concept.id).toBe("closures");
    expect(next.revisit).toBe(true);
  });

  it("serves a missed exercise concept at the next code slot", () => {
    const answers = session([
      ["closures", true],
      ["promises", true],
      ["array-methods", false],
    ]);
    expect(nextKind(answers)).toBe("code");
    expect(selectNextConcept("javascript", 1, answers)).toMatchObject({
      concept: { id: "array-methods" },
      revisit: true,
    });
  });

  it("keeps a missed non-exercise concept for the next choice slot", () => {
    const answers = session([
      ["strings", true],
      ["promises", true],
      ["closures", false],
    ]);
    for (const seed of SEEDS) {
      const atCode = selectNextConcept("javascript", seed, answers);
      expect(atCode.concept.id).not.toBe("closures");
      expect(atCode.concept.exercise).toBe(true);
      expect(atCode.revisit).toBe(false);

      const afterCode = [
        ...answers,
        { kind: "code", conceptId: atCode.concept.id, correct: true, stem: "Code" } as const,
      ];
      expect(nextKind(afterCode)).toBe("single");
      expect(selectNextConcept("javascript", seed, afterCode)).toMatchObject({
        concept: { id: "closures" },
        revisit: true,
      });
    }
  });

  it("prefers a compatible pending concept at a code slot, even if another miss is older", () => {
    const answers = session([
      ["closures", false],
      ["strings", false],
      ["promises", true],
    ]);
    expect(selectNextConcept("javascript", 1, answers)).toMatchObject({
      concept: { id: "strings" },
      revisit: true,
    });
  });

  it("serves the oldest miss first", () => {
    const answers = session([
      ["promises", false],
      ["closures", false],
    ]);
    expect(selectNextConcept("javascript", 1, answers).concept.id).toBe("promises");
  });

  it("orders misses by their latest attempt", () => {
    // promises was missed at 1 and again at 3, so the miss on closures (2) is older.
    const answers = session([
      ["promises", false],
      ["closures", false],
      ["promises", false],
      ["strings", true],
    ]);
    expect(selectNextConcept("javascript", 1, answers).concept.id).toBe("closures");
  });

  it("stops serving a concept once a revisit is correct", () => {
    const answers = session([
      ["closures", false],
      ["closures", true],
    ]);
    for (const seed of SEEDS) {
      const next = selectNextConcept("javascript", seed, answers);
      expect(next.concept.id).not.toBe("closures");
      expect(next.revisit).toBe(false);
    }
  });

  it(`serves a concept at most ${String(MAX_APPEARANCES)} times`, () => {
    const answers = session([
      ["closures", false],
      ["closures", false],
      ["closures", false],
      ["strings", true],
    ]);
    for (const seed of SEEDS) {
      const next = selectNextConcept("javascript", seed, answers);
      expect(next.concept.id).not.toBe("closures");
      expect(next.revisit).toBe(false);
    }
  });
});

describe("selectNextConcept: new concepts (AC-5.3)", () => {
  it("never reuses a concept while unused compatible ones remain", () => {
    const answers = session([
      ["closures", true],
      ["promises", true],
      ["strings", true],
    ]);
    for (const seed of SEEDS) {
      const next = selectNextConcept("javascript", seed, answers);
      expect(["closures", "promises", "strings"]).not.toContain(next.concept.id);
      expect(next.revisit).toBe(false);
    }
  });

  it("falls back on the least-used compatible concepts when none is unused", () => {
    // Every React exercise concept is used, reducers twice.
    const answers = session([
      ["state-and-immutable-updates", true],
      ["reducers", true],
      ["derived-state-and-selectors", true],
      ["events-and-forms", true],
      ["reducers", true],
      ["context", true],
      ["refs", true],
    ]);
    expect(nextKind(answers)).toBe("code");
    const chosen = new Set(
      SEEDS.map((seed) => selectNextConcept("react", seed, answers).concept.id),
    );
    expect([...chosen].sort()).toEqual([
      "derived-state-and-selectors",
      "events-and-forms",
      "state-and-immutable-updates",
    ]);
  });

  it("only uses exercise concepts at code slots", () => {
    const answers = session([
      ["closures", true],
      ["promises", true],
      ["modules", true],
    ]);
    for (const seed of SEEDS) {
      expect(selectNextConcept("javascript", seed, answers).concept.exercise).toBe(true);
    }
  });

  it("draws with mulberry32 seeded by seed + position", () => {
    const seed = 123_456_789;
    const concepts = conceptsOf("javascript");
    const index = Math.floor(mulberry32(seed + 1)() * concepts.length);
    expect(selectNextConcept("javascript", seed, []).concept).toEqual(concepts[index]);
  });

  it("spreads first questions across the topic", () => {
    for (const topic of TopicId.options) {
      const first = new Set(SEEDS.map((seed) => selectNextConcept(topic, seed, []).concept.id));
      expect(first.size).toBeGreaterThan(conceptsOf(topic).length / 2);
    }
  });
});

describe("selectNextConcept: determinism and bounds", () => {
  it("gives the same concept for the same (topic, seed, answers)", () => {
    const answers = session([
      ["closures", true],
      ["promises", false],
    ]);
    for (const seed of SEEDS) {
      expect(selectNextConcept("javascript", seed, answers)).toEqual(
        selectNextConcept("javascript", seed, structuredClone(answers)),
      );
    }
  });

  it("only returns concepts of the topic", () => {
    for (const topic of TopicId.options) {
      for (const seed of SEEDS) {
        const { concept } = selectNextConcept(topic, seed, []);
        expect(findConcept(topic, concept.id)).toEqual(concept);
      }
    }
  });

  it("throws once the session is complete", () => {
    const answers = Array.from({ length: SESSION_LENGTH }, () => ({
      conceptId: "closures",
      correct: true,
    }));
    expect(() => selectNextConcept("javascript", 1, answers)).toThrow(RangeError);
  });
});

describe("selectNextConcept: whole sessions", () => {
  /** Plays a session where each question uses the selected concept. */
  function play(topic: TopicId, seed: number, isCorrect: (index: number) => boolean) {
    const answers: AnsweredQuestion[] = [];
    const picks: ReturnType<typeof selectNextConcept>[] = [];
    for (let index = 0; index < SESSION_LENGTH; index++) {
      const next = selectNextConcept(topic, seed, answers);
      picks.push(next);
      answers.push({
        kind: nextKind(answers),
        conceptId: next.concept.id,
        correct: isCorrect(index),
        stem: `Question ${String(index + 1)}`,
      });
    }
    return { answers, picks };
  }

  const patterns: Record<string, (seed: number) => (index: number) => boolean> = {
    "all correct": () => () => true,
    "all incorrect": () => () => false,
    random: (seed) => {
      const next = mulberry32(seed ^ 0x5eed);
      return () => next() < 0.5;
    },
  };

  for (const topic of TopicId.options) {
    for (const [name, pattern] of Object.entries(patterns)) {
      it(`keeps every rule on ${topic} sessions, ${name}`, () => {
        for (const seed of SEEDS) {
          const { answers, picks } = play(topic, seed, pattern(seed));
          const counts = new Map<string, number>();

          picks.forEach((pick, index) => {
            const earlier = answers.slice(0, index);
            const previous = earlier.filter((answer) => answer.conceptId === pick.concept.id);
            const compatibleUnused = conceptsOf(topic).filter(
              (concept) =>
                (KIND_SCHEDULE[index] !== "code" || concept.exercise) &&
                !earlier.some((answer) => answer.conceptId === concept.id),
            );

            if (KIND_SCHEDULE[index] === "code") {
              expect(pick.concept.exercise).toBe(true);
            }
            expect(pick.revisit).toBe(previous.at(-1)?.correct === false);
            if (!pick.revisit && previous.length > 0) {
              expect(compatibleUnused).toEqual([]);
            }
            counts.set(pick.concept.id, (counts.get(pick.concept.id) ?? 0) + 1);
          });

          expect(Math.max(...counts.values())).toBeLessThanOrEqual(MAX_APPEARANCES);
          expect(checkSessionState({ topic, answers: answers.slice(0, -1) })).toEqual({
            ok: true,
          });
        }
      });
    }
  }
});
