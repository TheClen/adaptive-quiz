import type { RunInput, TestResult } from "@ai-in-learning/core/runner";

import type { RunnerClient } from "../runner/runnerClient.js";

/** A run the fake received, settled by the test. */
export interface PendingRun {
  readonly input: RunInput;
  resolve(results: readonly TestResult[]): void;
}

export interface FakeRunner {
  readonly runner: RunnerClient;
  /** How many times `preload` was called. */
  readonly preloads: () => number;
  /** Every `run` call, in order. */
  readonly runs: PendingRun[];
}

/** A {@link RunnerClient} whose runs stay pending until the test settles them. */
export function createFakeRunner(): FakeRunner {
  let preloads = 0;
  const runs: PendingRun[] = [];
  return {
    runner: {
      preload: () => {
        preloads += 1;
      },
      run: (input) =>
        new Promise((resolve) => {
          runs.push({ input, resolve });
        }),
      dispose: () => undefined,
    },
    preloads: () => preloads,
    runs,
  };
}
