import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";

import {
  validJavaScriptCodeDraft,
  validMultipleDraft,
  validReactCodeDraft,
  validSingleDraft,
} from "../testing/index.js";
import { ChoiceDraft, CodeExerciseDraft } from "./drafts.js";

describe("ChoiceDraft", () => {
  it("converts to a structured-output format", () => {
    const format = zodOutputFormat(ChoiceDraft);

    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({
      type: "object",
      required: ["snippet", "prompt", "options", "explanation"],
    });
  });

  it("puts the snippet before the question, so the question is written about the final code", () => {
    const { properties } = zodOutputFormat(ChoiceDraft).schema as { properties: object };

    expect(Object.keys(properties)).toEqual(["snippet", "prompt", "options", "explanation"]);
  });

  it("parses the valid fixtures", () => {
    expect(ChoiceDraft.parse(validSingleDraft)).toEqual(validSingleDraft);
    expect(ChoiceDraft.parse(validMultipleDraft)).toEqual(validMultipleDraft);
  });

  it("leaves counts and lengths to the domain rules, so their reason can be named", () => {
    expect(ChoiceDraft.safeParse({ ...validSingleDraft, options: [] }).success).toBe(true);
    expect(ChoiceDraft.safeParse({ ...validSingleDraft, prompt: "x".repeat(5_000) }).success).toBe(
      true,
    );
  });

  it("has no option ids: the server assigns them after the shuffle", () => {
    expect(Object.keys(ChoiceDraft.shape.options.element.shape).sort()).toEqual([
      "correct",
      "rationale",
      "text",
    ]);
  });
});

describe("CodeExerciseDraft", () => {
  it("converts to a structured-output format", () => {
    const format = zodOutputFormat(CodeExerciseDraft);

    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({
      type: "object",
      required: [
        "prompt",
        "functionName",
        "starterCode",
        "referenceSolution",
        "tests",
        "explanation",
      ],
    });
  });

  it("parses the valid fixtures", () => {
    expect(CodeExerciseDraft.parse(validJavaScriptCodeDraft)).toEqual(validJavaScriptCodeDraft);
    expect(CodeExerciseDraft.parse(validReactCodeDraft)).toEqual(validReactCodeDraft);
  });

  it("leaves counts, names and lengths to the checks, so their reason can be named", () => {
    const draft = { ...validJavaScriptCodeDraft, functionName: "not valid", tests: [] };
    expect(CodeExerciseDraft.safeParse(draft).success).toBe(true);
  });

  it("has tests as JSON text with no ids: the server parses them and assigns ids", () => {
    expect(Object.keys(CodeExerciseDraft.shape.tests.element.shape).sort()).toEqual([
      "argsJson",
      "checksImmutability",
      "description",
      "expectedJson",
    ]);
  });
});
