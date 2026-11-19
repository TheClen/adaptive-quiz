import { describe, expect, it } from "vitest";

import { multipleChoiceQuestion, singleChoiceWithSnippet } from "../testing/fixtures.js";
import { highlightSnippet } from "./highlight.js";

const javascript = singleChoiceWithSnippet.question.snippet;
const jsx = multipleChoiceQuestion.question.snippet;

/** The classes of the first segment whose text is exactly `text`. */
function classesOf(segments: ReturnType<typeof highlightSnippet>, text: string): string {
  return segments.find((segment) => segment.text === text)?.classes ?? "(not found)";
}

describe("highlightSnippet", () => {
  it("gives back the source unchanged when the segments are joined", () => {
    for (const snippet of [javascript, jsx]) {
      expect(
        highlightSnippet(snippet)
          .map((segment) => segment.text)
          .join(""),
      ).toBe(snippet.source);
    }
  });

  it("classes JavaScript tokens with the CodeMirror grammar (AC-2.5)", () => {
    const segments = highlightSnippet(javascript);

    expect(classesOf(segments, "function")).toBe("tok-keyword");
    expect(classesOf(segments, "makeCounter")).toBe("tok-variableName tok-definition");
    expect(classesOf(segments, "0")).toBe("tok-number");
    expect(classesOf(segments, '"calls"')).toBe("tok-string");
    expect(classesOf(segments, "true")).toBe("tok-bool");
    expect(classesOf(segments, "// Counts the calls")).toBe("tok-comment");
    expect(classesOf(segments, "log")).toBe("tok-propertyName");
  });

  it("classes JSX tags and attributes in a JSX snippet", () => {
    const segments = highlightSnippet(jsx);

    expect(classesOf(segments, "li").split(" ")).toContain("tok-tagName");
    expect(classesOf(segments, "className").split(" ")).toContain("tok-attributeName");
    expect(classesOf(segments, '"todo"')).toBe("tok-string");
    expect(segments.some((segment) => segment.classes.includes("tok-invalid"))).toBe(false);
  });

  it("does not read JSX in a JavaScript snippet", () => {
    const segments = highlightSnippet({ language: "javascript", source: "const a = <p>Hi</p>;" });

    expect(classesOf(segments, "p")).not.toBe("tok-tagName");
  });
});
