import { TopicId } from "@ai-in-learning/shared-types";
import { describe, expect, it } from "vitest";

import { packageName } from "./index.js";

describe("@ai-in-learning/core", () => {
  it("exposes its entry point", () => {
    expect(packageName).toBe("@ai-in-learning/core");
  });

  it("imports a workspace package through its source condition, without a build", () => {
    expect(TopicId.options).toEqual(["javascript", "react"]);
  });
});
