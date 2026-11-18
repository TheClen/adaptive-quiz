import { describe, expect, it } from "vitest";

import { findNearDuplicate, NEAR_DUPLICATE_THRESHOLD, stemSimilarity } from "./similarity.js";

describe("stemSimilarity", () => {
  it("is 1 for the same stem, whatever the case, punctuation and whitespace", () => {
    expect(
      stemSimilarity("What does `typeof null` return?", "  what DOES typeof   null return ..."),
    ).toBe(1);
  });

  it("is 0 for stems that share no word trigram", () => {
    expect(
      stemSimilarity("What does typeof null return?", "Which hooks run after every render?"),
    ).toBe(0);
  });

  it("is the Jaccard index of the word trigrams", () => {
    // 6 trigrams each, 5 shared: 5 / 7.
    expect(
      stemSimilarity(
        "Which statements about closures in JavaScript are true?",
        "Which statements about closures in JavaScript are correct?",
      ),
    ).toBeCloseTo(5 / 7);
  });

  it("compares stems of one or two words as a whole", () => {
    expect(stemSimilarity("Closures?", "closures")).toBe(1);
    expect(stemSimilarity("Closures?", "Promises?")).toBe(0);
  });

  it("is 0 when both stems have no word", () => {
    expect(stemSimilarity("?!", "...")).toBe(0);
  });
});

describe("findNearDuplicate", () => {
  const previous = [
    "When does the callback passed to then run?",
    "Which statements about closures in JavaScript are correct?",
  ];

  it("gives the index of the first stem at or above the threshold", () => {
    expect(
      findNearDuplicate("Which statements about closures in JavaScript are true?", previous),
    ).toBe(1);
  });

  it("gives -1 when every stem is below the threshold", () => {
    expect(NEAR_DUPLICATE_THRESHOLD).toBe(0.6);
    expect(
      findNearDuplicate(
        "Which of the following statements about closures in JavaScript are true?",
        previous,
      ),
    ).toBe(-1);
    expect(findNearDuplicate("Anything at all?", [])).toBe(-1);
  });
});
