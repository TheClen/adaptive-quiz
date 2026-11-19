import type { RunInput, TestResult } from "@ai-in-learning/core/runner";

/** A message from the page to the runner worker. */
export interface RunRequest {
  readonly type: "run";
  /** Matches the request with its {@link RunResults}. */
  readonly id: number;
  readonly input: RunInput;
}

/** A message from the runner worker to the page. */
export type RunnerMessage =
  /** The QuickJS WebAssembly module is loaded: runs start without waiting for it. */
  | { readonly type: "ready" }
  /** The module could not be loaded. The worker is unusable. */
  | { readonly type: "loadFailed" }
  | RunResults;

export interface RunResults {
  readonly type: "results";
  readonly id: number;
  readonly results: readonly TestResult[];
}
