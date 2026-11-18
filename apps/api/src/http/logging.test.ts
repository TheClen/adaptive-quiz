import { hashIp } from "@ai-in-learning/core/server";
import { describe, expect, it } from "vitest";

import { forwardedIpHash, loggedPath } from "./logging.js";

describe("forwardedIpHash", () => {
  it("hashes the first value of x-forwarded-for", async () => {
    expect(await forwardedIpHash(" 198.51.100.7 , 10.0.0.1")).toBe(await hashIp("198.51.100.7"));
  });

  it.each([undefined, "", " ", ", 10.0.0.1"])(
    "is null without a first value (%j)",
    async (header) => {
      expect(await forwardedIpHash(header)).toBeNull();
    },
  );
});

describe("loggedPath", () => {
  it("keeps a normal path and cuts a long one to 200 characters", () => {
    expect(loggedPath("/api/quiz/next-question")).toBe("/api/quiz/next-question");
    expect(loggedPath(`/${"a".repeat(500)}`)).toHaveLength(200);
  });
});
