import { expect, it } from "vitest";

// Deliberately failing test for the T03 red check. Reverted right after.
it("fails on purpose to prove CI turns red", () => {
  expect(1).toBe(2);
});
