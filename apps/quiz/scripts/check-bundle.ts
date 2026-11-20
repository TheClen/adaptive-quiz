/**
 * Bundle check (plan §14, principle II): fails when the built quiz app contains a
 * string that suggests a server secret leaked into it. It runs after `vite build`, so
 * CI and every deployment check the files that are actually served.
 *
 * Usage: `node scripts/check-bundle.ts [dist directory]` (default: `dist`).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

/** Strings that must never reach the browser: an Anthropic key prefix and server variable names. */
export const FORBIDDEN_STRINGS = ["sk-ant", "ANTHROPIC", "UPSTASH"] as const;

export interface BundleFinding {
  /** Path of the file, relative to the scanned directory. */
  file: string;
  forbidden: (typeof FORBIDDEN_STRINGS)[number];
}

/**
 * Scans every file under `directory`, text and binary alike, and returns each
 * forbidden string found. Throws when the directory is missing or holds no file, so a
 * check run before the build cannot pass by accident.
 */
export async function findForbiddenStrings(directory: string): Promise<BundleFinding[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  if (files.length === 0) {
    throw new Error(`No file to check in ${directory}. Run the build first.`);
  }
  const findings: BundleFinding[] = [];
  for (const entry of files) {
    const path = join(entry.parentPath, entry.name);
    const content = await readFile(path);
    for (const forbidden of FORBIDDEN_STRINGS) {
      if (content.includes(forbidden)) {
        findings.push({ file: relative(directory, path), forbidden });
      }
    }
  }
  return findings;
}

async function main(directory: string): Promise<void> {
  const findings = await findForbiddenStrings(directory);
  if (findings.length === 0) {
    console.log(`Bundle check passed: no forbidden string in ${directory}.`);
    return;
  }
  for (const { file, forbidden } of findings) {
    console.error(`${file}: contains "${forbidden}"`);
  }
  console.error("Bundle check failed: server secrets must never reach the quiz bundle.");
  process.exitCode = 1;
}

if (import.meta.main) {
  await main(process.argv[2] ?? "dist");
}
