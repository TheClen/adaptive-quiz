/**
 * The runner worker: runs the visitor's code in QuickJS, off the main thread, so the
 * page stays responsive while a run is stuck (plan §9.2, AC-3.4). Only
 * `runnerClient.ts` talks to it.
 */
import { createRunner, loadQuickJS, RUN_TIMEOUT_MS } from "@ai-in-learning/core/runner";

import type { RunnerMessage, RunRequest } from "./protocol.js";

/**
 * The parts of the worker's global scope used here. The app is type checked with the
 * DOM library, which types `self` as a window, so the worker scope is described here.
 */
interface RunnerWorkerScope {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage(message: RunnerMessage): void;
}

const scope = self as unknown as RunnerWorkerScope;

// The worker starts when a session starts (plan §9.2), so the WebAssembly module is
// loaded then, well before the first exercise.
let firstModule: ReturnType<typeof loadQuickJS> | undefined = loadQuickJS();
firstModule.then(
  () => {
    scope.postMessage({ type: "ready" });
  },
  () => {
    scope.postMessage({ type: "loadFailed" });
  },
);

const runner = createRunner({
  timeoutMs: RUN_TIMEOUT_MS.browser,
  // The first run uses the module loaded above. The runner asks again only after the
  // module failed, and then needs a new one.
  load: () => {
    const module = firstModule ?? loadQuickJS();
    firstModule = undefined;
    return module;
  },
});

scope.onmessage = (event) => {
  const { id, input } = event.data;
  void runner.run(input).then((results) => {
    scope.postMessage({ type: "results", id, results });
  });
};
