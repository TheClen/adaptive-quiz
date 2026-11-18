import type { QuickJSWASMModule } from "quickjs-emscripten";

import { loadQuickJS, REASONS, runInQuickJS } from "./quickjs.js";
import type { RunInput, RunLimits, TestResult } from "./types.js";

/** Time limit of one run, per host (plan §9.2). */
export const RUN_TIMEOUT_MS = {
  /** Visitor code in the browser Web Worker (AC-3.4). */
  browser: 3_000,
  /** Reference solutions and submitted code in the API (AC-3.6). */
  server: 2_000,
} as const;

/** Memory limit of one QuickJS runtime (plan §9.2). */
export const MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;

/**
 * Stack limit of one QuickJS runtime. QuickJS runs on the host's own call stack, so
 * its limit must be reached well before the host's: with 256 KiB, some recursions
 * already overflow Node's stack. 128 KiB still allows several hundred nested calls.
 */
export const STACK_LIMIT_BYTES = 128 * 1024;

export interface RunnerOptions {
  readonly timeoutMs: number;
  /** Defaults to {@link MEMORY_LIMIT_BYTES}. */
  readonly memoryBytes?: number;
  /** Defaults to {@link STACK_LIMIT_BYTES}. */
  readonly stackBytes?: number;
  /** Defaults to {@link loadQuickJS}. */
  readonly load?: () => Promise<QuickJSWASMModule>;
}

export interface Runner {
  /**
   * Runs every test of an exercise against `input.code`, in a fresh QuickJS runtime.
   * Results come in the order of `input.tests`. Code that fails in any way produces
   * failed tests, never a rejected promise.
   */
  run(input: RunInput): Promise<TestResult[]>;
}

/**
 * Creates a runner. The WebAssembly module is loaded on the first run and kept by the
 * runner, not by this module, so the caller decides how long it lives. Each run still
 * gets its own runtime and context.
 */
export function createRunner(options: RunnerOptions): Runner {
  const limits: RunLimits = {
    timeoutMs: options.timeoutMs,
    memoryBytes: options.memoryBytes ?? MEMORY_LIMIT_BYTES,
    stackBytes: options.stackBytes ?? STACK_LIMIT_BYTES,
  };
  const load = options.load ?? loadQuickJS;
  let module: Promise<QuickJSWASMModule> | undefined;

  return {
    async run(input) {
      module ??= load();
      const current = module;
      try {
        return runInQuickJS(await current, input, limits);
      } catch {
        // The WebAssembly module failed (for example, the host stack overflowed). Its
        // memory may be corrupt, so the next run loads a new one.
        if (module === current) module = undefined;
        return input.tests.map((test) => ({
          testId: test.id,
          passed: false,
          reason: REASONS.crashed,
        }));
      }
    },
  };
}
