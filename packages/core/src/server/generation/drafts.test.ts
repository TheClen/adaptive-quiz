import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";

import { validMultipleDraft, validSingleDraft } from "../testing/index.js";
import { ChoiceDraft } from "./drafts.js";

describe("ChoiceDraft", () => {
  it("converts to a structured-output format", () => {
    const format = zodOutputFormat(ChoiceDraft);

    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({
      type: "object",
      required: ["prompt", "snippet", "options", "explanation"],
    });
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
