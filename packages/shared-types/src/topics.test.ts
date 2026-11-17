import { describe, expect, it } from "vitest";

import {
  ConceptId,
  conceptIdsByTopic,
  isConceptOfTopic,
  JavaScriptConceptId,
  Level,
  Position,
  ReactConceptId,
  TopicId,
} from "./index.js";

describe("TopicId", () => {
  it("lists the two topics", () => {
    expect(TopicId.options).toEqual(["javascript", "react"]);
  });
});

describe("concept ids", () => {
  it("has the 17 JavaScript and 13 React concepts of plan §6.3", () => {
    expect(JavaScriptConceptId.options).toHaveLength(17);
    expect(ReactConceptId.options).toHaveLength(13);
  });

  it("never shares an id between topics", () => {
    const shared = JavaScriptConceptId.options.filter((id) =>
      (ReactConceptId.options as readonly string[]).includes(id),
    );
    expect(shared).toEqual([]);
  });

  it("maps each topic to its own enum", () => {
    expect(conceptIdsByTopic.javascript).toBe(JavaScriptConceptId);
    expect(conceptIdsByTopic.react).toBe(ReactConceptId);
  });

  it("accepts any known concept id and rejects unknown ones", () => {
    expect(ConceptId.safeParse("closures").success).toBe(true);
    expect(ConceptId.safeParse("use-effect").success).toBe(true);
    expect(ConceptId.safeParse("monads").success).toBe(false);
  });

  it("tells whether a concept belongs to a topic", () => {
    expect(isConceptOfTopic("javascript", "closures")).toBe(true);
    expect(isConceptOfTopic("react", "use-effect")).toBe(true);
    expect(isConceptOfTopic("javascript", "use-effect")).toBe(false);
    expect(isConceptOfTopic("react", "closures")).toBe(false);
    expect(isConceptOfTopic("react", "monads")).toBe(false);
  });
});

describe("Level and Position", () => {
  it.each([1, 5])("accepts level %d", (level) => {
    expect(Level.safeParse(level).success).toBe(true);
  });

  it.each([0, 6, 2.5])("rejects level %d", (level) => {
    expect(Level.safeParse(level).success).toBe(false);
  });

  it.each([1, 10])("accepts position %d", (position) => {
    expect(Position.safeParse(position).success).toBe(true);
  });

  it.each([0, 11])("rejects position %d", (position) => {
    expect(Position.safeParse(position).success).toBe(false);
  });
});
