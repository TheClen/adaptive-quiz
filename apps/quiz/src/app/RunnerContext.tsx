import { createContext, type ReactNode, use } from "react";

import type { RunnerClient } from "../runner/runnerClient.js";

const RunnerContext = createContext<RunnerClient | null>(null);

/** Provides the {@link RunnerClient}: the worker client in the app, a fake in tests. */
export function RunnerProvider({
  runner,
  children,
}: {
  readonly runner: RunnerClient;
  readonly children: ReactNode;
}) {
  return <RunnerContext value={runner}>{children}</RunnerContext>;
}

/** The {@link RunnerClient} of the nearest {@link RunnerProvider}. */
export function useRunner(): RunnerClient {
  const runner = use(RunnerContext);
  if (runner === null) {
    throw new Error("useRunner must be used inside a RunnerProvider");
  }
  return runner;
}
