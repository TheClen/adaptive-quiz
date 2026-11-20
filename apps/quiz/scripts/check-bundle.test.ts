import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findForbiddenStrings } from "./check-bundle.js";

describe("findForbiddenStrings", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "bundle-check-"));
    await mkdir(join(directory, "assets"));
    await writeFile(join(directory, "index.html"), "<!doctype html><title>Quiz</title>");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("passes a bundle without forbidden strings", async () => {
    await writeFile(join(directory, "assets", "index.js"), 'console.log("Anthropic");');

    await expect(findForbiddenStrings(directory)).resolves.toEqual([]);
  });

  it("reports each forbidden string with its file, in nested folders too", async () => {
    await writeFile(join(directory, "assets", "index.js"), 'const key = "sk-ant-api03-x";');
    await writeFile(
      join(directory, "assets", "worker.js"),
      "env.ANTHROPIC_API_KEY; env.UPSTASH_REDIS_REST_TOKEN;",
    );

    const findings = await findForbiddenStrings(directory);

    expect(findings).toHaveLength(3);
    expect(findings).toEqual(
      expect.arrayContaining([
        { file: join("assets", "index.js"), forbidden: "sk-ant" },
        { file: join("assets", "worker.js"), forbidden: "ANTHROPIC" },
        { file: join("assets", "worker.js"), forbidden: "UPSTASH" },
      ]),
    );
  });

  it("scans binary files", async () => {
    const bytes = Buffer.concat([Buffer.from([0, 97, 115, 109]), Buffer.from("UPSTASH")]);
    await writeFile(join(directory, "assets", "module.wasm"), bytes);

    await expect(findForbiddenStrings(directory)).resolves.toEqual([
      { file: join("assets", "module.wasm"), forbidden: "UPSTASH" },
    ]);
  });

  it("fails when there is nothing to check", async () => {
    const empty = await mkdtemp(join(tmpdir(), "bundle-check-empty-"));
    try {
      await expect(findForbiddenStrings(empty)).rejects.toThrow("Run the build first");
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it("fails when the directory does not exist", async () => {
    await expect(findForbiddenStrings(join(directory, "missing"))).rejects.toThrow();
  });
});
