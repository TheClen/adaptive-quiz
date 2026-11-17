import { describe, expect, it } from "vitest";

import { packageName } from "./index.js";

describe("@ai-in-learning/shared-types", () => {
  it("exposes its entry point", () => {
    expect(packageName).toBe("@ai-in-learning/shared-types");
  });
});
