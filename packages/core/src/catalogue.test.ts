import { conceptIdsByTopic, TopicId } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { CATALOGUE, conceptsOf, findConcept } from "./catalogue.js";

/** The concepts marked "yes" in the Exercise column of plan §6.3. */
const EXERCISE_CONCEPTS = {
  javascript: [
    "types-and-coercion",
    "functions",
    "array-methods",
    "objects-and-destructuring",
    "immutability-and-copying",
    "strings",
    "maps-and-sets",
  ],
  react: [
    "state-and-immutable-updates",
    "reducers",
    "derived-state-and-selectors",
    "events-and-forms",
  ],
} as const;

describe.each(TopicId.options)("catalogue of %s (AC-5.1)", (topic) => {
  const enumIds = conceptIdsByTopic[topic].options;

  it("has an entry for every concept id of the shared-types enum", () => {
    for (const id of enumIds) {
      expect(Object.keys(CATALOGUE[topic])).toContain(id);
    }
  });

  it("has no entry outside the shared-types enum", () => {
    for (const id of Object.keys(CATALOGUE[topic])) {
      expect(enumIds).toContain(id);
    }
  });

  it("lists its concepts in enum order, with their ids", () => {
    expect(conceptsOf(topic).map((concept) => concept.id)).toEqual(enumIds);
  });

  it("gives every concept a non-empty label and description", () => {
    for (const concept of conceptsOf(topic)) {
      expect(concept.label.trim()).not.toBe("");
      expect(concept.description.trim()).not.toBe("");
    }
  });

  it("uses distinct labels", () => {
    const labels = conceptsOf(topic).map((concept) => concept.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('flags as exercise only the concepts marked "yes" in plan §6.3 (AC-3.7)', () => {
    const flagged = conceptsOf(topic)
      .filter((concept) => concept.exercise)
      .map((concept) => concept.id);
    expect(flagged).toEqual(EXERCISE_CONCEPTS[topic]);
  });
});

describe("findConcept", () => {
  it("finds a concept of the topic", () => {
    expect(findConcept("javascript", "closures")).toEqual({
      id: "closures",
      label: "Closures",
      description: "lexical scope, functions capturing variables, factories",
      exercise: false,
    });
    expect(findConcept("react", "reducers")?.exercise).toBe(true);
  });

  it("returns undefined for a concept of the other topic or an unknown id", () => {
    expect(findConcept("javascript", "use-effect")).toBeUndefined();
    expect(findConcept("react", "closures")).toBeUndefined();
    expect(findConcept("react", "monads")).toBeUndefined();
  });
});
