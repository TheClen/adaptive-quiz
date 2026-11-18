import { TopicId } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import * as core from "./index.js";

describe("@ai-in-learning/core", () => {
  it("exposes the catalogue, the rubric and the kind schedule", () => {
    expect(core.CATALOGUE).toBeDefined();
    expect(core.DIFFICULTY_RUBRIC).toBeDefined();
    expect(core.KIND_SCHEDULE).toBeDefined();
  });

  it("imports a workspace package through its source condition, without a build", () => {
    expect(TopicId.options).toEqual(["javascript", "react"]);
  });
});
