import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ModelRequest } from "../model-client.js";
import { ModelError } from "../model-errors.js";
import { FakeModelClient } from "./fake-model-client.js";

const Draft = z.object({ answer: z.string() });

const request: ModelRequest<z.infer<typeof Draft>> = {
  route: "choice",
  system: "System prompt",
  messages: [{ role: "user", content: "Question please" }],
  schema: Draft,
};

describe("FakeModelClient", () => {
  it("answers each call with the next step and records the requests", async () => {
    const fake = new FakeModelClient([{ output: { answer: "a" } }, { failure: "refusal" }]);

    await expect(fake.generate(request)).resolves.toMatchObject({
      ok: true,
      output: { answer: "a" },
    });
    await expect(fake.generate(request)).resolves.toMatchObject({ ok: false, reason: "refusal" });
    expect(fake.callCount).toBe(2);
    expect(fake.requests).toEqual([request, request]);
  });

  it("validates outputs against the request schema, like the real adapter", async () => {
    const fake = new FakeModelClient([{ output: { answer: 42 } }]);

    await expect(fake.generate(request)).resolves.toMatchObject({
      ok: false,
      reason: "invalid_output",
    });
  });

  it("throws a scripted error", async () => {
    const error = new ModelError("ai_unavailable");
    const fake = new FakeModelClient([{ error }]);

    await expect(fake.generate(request)).rejects.toBe(error);
  });

  it("fails when called more often than scripted", async () => {
    const fake = new FakeModelClient([]);

    await expect(fake.generate(request)).rejects.toThrow("no step scripted for call 1");
  });
});
