import { REASONS, type RunInput, type TestResult } from "@ai-in-learning/core/runner";

import type { RunnerMessage, RunRequest } from "./protocol.js";

/**
 * Time a run may take in the worker before the page gives up on it. The worker stops
 * code after 3 s on its own (AC-3.4); this catches a worker that does not answer
 * anyway (plan §9.2).
 */
export const BACKSTOP_MS = 5_000;

/** Runs the tests of code exercises in the runner worker. */
export interface RunnerClient {
  /**
   * Starts the worker, which loads the QuickJS WebAssembly module, so the first run
   * does not wait for it. Called when a session starts (plan §9.2).
   */
  preload(): void;
  /**
   * Runs every test of an exercise against `input.code`. Runs happen one at a time, in
   * the order they are asked for. Never rejects: a run that cannot finish gives failed
   * tests with a reason.
   */
  run(input: RunInput): Promise<readonly TestResult[]>;
  /** Stops the worker. The run in progress finishes with failed tests; a later run starts a new worker. */
  dispose(): void;
}

/** The parts of a `Worker` the client uses, so tests can pass a fake one. */
export interface RunnerWorker {
  onmessage: ((event: MessageEvent<RunnerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: RunRequest): void;
  terminate(): void;
}

export interface RunnerClientOptions {
  /** Defaults to a module worker running `runner.worker.ts`. */
  readonly createWorker?: () => RunnerWorker;
  /** Defaults to {@link BACKSTOP_MS}. */
  readonly backstopMs?: number;
}

function createRunnerWorker(): RunnerWorker {
  // Written inline so Vite bundles the worker and its QuickJS module as a separate
  // chunk, fetched only when the worker starts.
  return new Worker(new URL("./runner.worker.ts", import.meta.url), {
    type: "module",
    name: "runner",
  });
}

function failAll(input: RunInput, reason: string): TestResult[] {
  return input.tests.map((test) => ({ testId: test.id, passed: false, reason }));
}

/** A worker and whether its WebAssembly module is loaded. */
interface WorkerSlot {
  readonly worker: RunnerWorker;
  ready: boolean;
}

/** The run the worker is working on. */
interface ActiveRun {
  readonly id: number;
  readonly input: RunInput;
  readonly slot: WorkerSlot;
  backstop: ReturnType<typeof setTimeout> | undefined;
  readonly settle: (results: readonly TestResult[]) => void;
}

/**
 * Creates the client of the runner worker.
 *
 * Backstop (plan §9.2): when the worker gives no results {@link BACKSTOP_MS} after a
 * run started, the client terminates it, fails every test with the timeout reason,
 * and starts a new worker for the next run. The delay counts from the moment the
 * worker has its WebAssembly module, so a slow download is not mistaken for code
 * that never stops.
 */
export function createRunnerClient(options: RunnerClientOptions = {}): RunnerClient {
  const createWorker = options.createWorker ?? createRunnerWorker;
  const backstopMs = options.backstopMs ?? BACKSTOP_MS;
  let slot: WorkerSlot | undefined;
  let active: ActiveRun | undefined;
  let lastId = 0;
  // Runs wait for the previous one: the worker runs one at a time, and the backstop
  // of a run must not count the time spent waiting.
  let queue: Promise<unknown> = Promise.resolve();

  function start(): WorkerSlot {
    const worker = createWorker();
    const started: WorkerSlot = { worker, ready: false };
    worker.onmessage = (event) => {
      const message = event.data;
      switch (message.type) {
        case "ready":
          started.ready = true;
          if (active?.slot === started) armBackstop(active);
          return;
        case "loadFailed":
          stop(started);
          failActive(started, REASONS.harness);
          return;
        case "results":
          if (active?.slot === started && active.id === message.id) {
            active.settle(message.results);
          }
          return;
      }
    };
    worker.onerror = () => {
      stop(started);
      failActive(started, REASONS.harness);
    };
    slot = started;
    return started;
  }

  /** Terminates a worker. The next run, or preload, starts a new one. */
  function stop(stopped: WorkerSlot): void {
    stopped.worker.onmessage = null;
    stopped.worker.onerror = null;
    stopped.worker.terminate();
    if (slot === stopped) slot = undefined;
  }

  function failActive(stopped: WorkerSlot, reason: string): void {
    if (active?.slot === stopped) active.settle(failAll(active.input, reason));
  }

  function armBackstop(run: ActiveRun): void {
    run.backstop ??= setTimeout(() => {
      stop(run.slot);
      run.settle(failAll(run.input, REASONS.timeout(backstopMs)));
      // The visitor will likely run the tests again: have a worker ready for it.
      start();
    }, backstopMs);
  }

  function runNow(input: RunInput): Promise<readonly TestResult[]> {
    return new Promise((resolve) => {
      const current = slot ?? start();
      const run: ActiveRun = {
        id: ++lastId,
        input,
        slot: current,
        backstop: undefined,
        settle: (results) => {
          clearTimeout(run.backstop);
          if (active === run) active = undefined;
          resolve(results);
        },
      };
      active = run;
      current.worker.postMessage({ type: "run", id: run.id, input });
      if (current.ready) armBackstop(run);
    });
  }

  return {
    preload() {
      if (slot === undefined) start();
    },
    run(input) {
      const result = queue.then(() => runNow(input));
      queue = result;
      return result;
    },
    dispose() {
      if (slot === undefined) return;
      const stopped = slot;
      stop(stopped);
      failActive(stopped, REASONS.harness);
    },
  };
}
