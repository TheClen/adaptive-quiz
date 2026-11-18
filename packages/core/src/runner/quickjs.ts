import { CodeExercise } from "@ai-in-learning/shared-types";
import {
  newQuickJSWASMModule,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
} from "quickjs-emscripten";

import { HARNESS_SOURCE } from "./harness.js";
import type { RunInput, RunLimits, TestResult } from "./types.js";

/**
 * Loads the QuickJS WebAssembly build (release, synchronous variant). The same call
 * works on Node, in a Vercel Function and in a browser Web Worker: the variant finds
 * its `.wasm` file next to its own module.
 */
export function loadQuickJS(): Promise<QuickJSWASMModule> {
  return newQuickJSWASMModule();
}

/** Fixed failure reasons produced by the host (the others come from the harness). */
export const REASONS = {
  timeout: (timeoutMs: number) => {
    const seconds = timeoutMs / 1_000;
    return `Stopped after ${String(seconds)} ${seconds === 1 ? "second" : "seconds"}: the code may contain an infinite loop`;
  },
  missingFunction: (functionName: string) => `No function named ${functionName} was found`,
  crashed: "Stopped: the code ran out of memory or recursed too deeply",
  harness: "The tests could not run",
} as const;

const functionNameSchema = CodeExercise.shape.functionName;

function failAll(input: RunInput, reason: string): TestResult[] {
  return input.tests.map((test) => ({ testId: test.id, passed: false, reason }));
}

/**
 * Runs the tests of one exercise in a fresh QuickJS runtime and context, then disposes
 * of both. Nothing the code does can reach the next run.
 *
 * Every failure caused by the code (syntax error, exception, wrong result, timeout,
 * memory or stack limit) becomes a failed test with a reason. It throws only when the
 * WebAssembly module itself fails, which leaves the module unusable: the caller must
 * then load a new one.
 */
export function runInQuickJS(
  module: QuickJSWASMModule,
  input: RunInput,
  limits: RunLimits,
): TestResult[] {
  const runtime = module.newRuntime();
  const handles: QuickJSHandle[] = [];
  let context: QuickJSContext | undefined;

  const execute = (): TestResult[] => {
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const deadline = Date.now() + limits.timeoutMs;
    let timedOut = false;
    // QuickJS calls this regularly while it runs. Returning true raises an error that
    // the code cannot catch, and it keeps returning true, so nothing runs after it.
    runtime.setInterruptHandler(() => {
      if (!timedOut && Date.now() >= deadline) timedOut = true;
      return timedOut;
    });
    // A function, because the handler changes `timedOut` during calls into QuickJS,
    // which the type checker cannot see.
    const hasTimedOut = (): boolean => timedOut;
    context = runtime.newContext();
    const ctx = context;
    const keep = (handle: QuickJSHandle): QuickJSHandle => {
      handles.push(handle);
      return handle;
    };

    const harness = keep(ctx.unwrapResult(ctx.evalCode(HARNESS_SOURCE, "harness.js")));
    const runTest = keep(ctx.getProp(harness, "runTest"));
    const describeThrown = keep(ctx.getProp(harness, "describeThrown"));

    const describe = (error: QuickJSHandle): string => {
      const described = ctx.callFunction(describeThrown, ctx.undefined, error);
      if (described.error) {
        described.error.dispose();
        return REASONS.harness;
      }
      const text = ctx.typeof(described.value) === "string" ? ctx.getString(described.value) : "";
      described.value.dispose();
      return text === "" ? REASONS.harness : `Threw ${text}`;
    };

    const loaded = ctx.evalCode(`"use strict";${input.code}`, "solution.js");
    if (loaded.error) {
      keep(loaded.error);
      return failAll(
        input,
        hasTimedOut() ? REASONS.timeout(limits.timeoutMs) : describe(loaded.error),
      );
    }
    keep(loaded.value);

    // The name is checked against the exercise schema before it is placed in code.
    // `typeof` finds both function declarations and top-level `const` bindings.
    const name = input.functionName;
    if (!functionNameSchema.safeParse(name).success) {
      return failAll(input, REASONS.missingFunction(name));
    }
    const lookup = ctx.evalCode(`typeof ${name} === "function" ? ${name} : undefined`);
    const fn = keep(lookup.error ?? lookup.value);
    if (lookup.error || ctx.typeof(fn) !== "function") {
      return failAll(
        input,
        hasTimedOut() ? REASONS.timeout(limits.timeoutMs) : REASONS.missingFunction(name),
      );
    }

    return input.tests.map((test): TestResult => {
      if (hasTimedOut()) {
        return { testId: test.id, passed: false, reason: REASONS.timeout(limits.timeoutMs) };
      }
      const args = [
        fn,
        keep(ctx.newString(JSON.stringify(test.args))),
        keep(ctx.newString(JSON.stringify(test.expected))),
        test.checksImmutability ? ctx.true : ctx.false,
      ];
      const outcome = ctx.callFunction(runTest, ctx.undefined, ...args);
      const value = keep(outcome.error ?? outcome.value);
      if (outcome.error) {
        const reason = hasTimedOut() ? REASONS.timeout(limits.timeoutMs) : describe(value);
        return { testId: test.id, passed: false, reason };
      }
      if (ctx.typeof(value) === "string") {
        return { testId: test.id, passed: false, reason: ctx.getString(value) };
      }
      return ctx.dump(value) === true
        ? { testId: test.id, passed: true }
        : { testId: test.id, passed: false, reason: REASONS.harness };
    });
  };

  // When `execute` throws, the module is unusable and nothing is disposed: the caller
  // drops the whole module.
  const results = execute();
  // Handles must be released before their context, and the context before its runtime,
  // or QuickJS reports a leak.
  for (const handle of handles.reverse()) {
    if (handle.alive) handle.dispose();
  }
  context?.dispose();
  runtime.dispose();
  return results;
}
