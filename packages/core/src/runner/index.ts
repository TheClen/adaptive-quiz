/**
 * Exercise runner: the test harness and its QuickJS adapter, for the browser Web Worker
 * and the API (plan §9.2, ADR 0005).
 */
export { MAX_VALUE_LENGTH } from "./harness.js";
export { loadQuickJS, REASONS } from "./quickjs.js";
export {
  createRunner,
  MEMORY_LIMIT_BYTES,
  RUN_TIMEOUT_MS,
  STACK_LIMIT_BYTES,
  type Runner,
  type RunnerOptions,
} from "./runner.js";
export type { RunInput, RunLimits, TestResult } from "./types.js";
