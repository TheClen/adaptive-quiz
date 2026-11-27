import type { ExerciseTest, Json } from "@ai-in-learning/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  createRunner,
  loadQuickJS,
  MAX_VALUE_LENGTH,
  REASONS,
  RUN_TIMEOUT_MS,
  type RunInput,
  type TestResult,
} from "./index.js";

// These tests use the real QuickJS WebAssembly build (ADR 0005).
const runner = createRunner({ timeoutMs: RUN_TIMEOUT_MS.server });

function makeTest(id: string, args: Json[], expected: Json, checksImmutability = false) {
  return {
    id,
    description: `Test ${id}`,
    args,
    expected,
    checksImmutability,
  } satisfies ExerciseTest;
}

const addTodoTests = [
  makeTest("empty", [[], "Buy milk"], [{ title: "Buy milk", done: false }]),
  makeTest(
    "append",
    [[{ title: "Read", done: true }], "Write"],
    [
      { title: "Read", done: true },
      { title: "Write", done: false },
    ],
  ),
  makeTest(
    "immutable",
    [[{ title: "Read", done: true }], "Write"],
    [
      { title: "Read", done: true },
      { title: "Write", done: false },
    ],
    true,
  ),
];

function addTodo(code: string): RunInput {
  return { code, functionName: "addTodo", tests: addTodoTests };
}

function reasons(results: TestResult[]): (string | null)[] {
  return results.map((result) => (result.passed ? null : result.reason));
}

describe("a correct solution", () => {
  it("passes every test, in the order of the tests", async () => {
    const results = await runner.run(
      addTodo("function addTodo(todos, title) { return [...todos, { title, done: false }]; }"),
    );
    expect(results).toEqual([
      { testId: "empty", passed: true },
      { testId: "append", passed: true },
      { testId: "immutable", passed: true },
    ]);
  });

  it("is found when it is a top-level const arrow function", async () => {
    const results = await runner.run(
      addTodo("const addTodo = (todos, title) => todos.concat([{ done: false, title }]);"),
    );
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("matches objects whatever the order of their keys", async () => {
    const results = await runner.run({
      code: "function pair() { return { b: 2, a: 1 }; }",
      functionName: "pair",
      tests: [makeTest("t", [], { a: 1, b: 2 })],
    });
    expect(results[0]?.passed).toBe(true);
  });
});

describe("a wrong solution", () => {
  it("fails with the expected and actual values", async () => {
    const results = await runner.run({
      code: "function sortAscending(list) { return [...list].sort((a, b) => b - a); }",
      functionName: "sortAscending",
      tests: [makeTest("t", [[2, 1]], [1, 2])],
    });
    expect(results).toEqual([
      { testId: "t", passed: false, reason: "Expected [1, 2] but got [2, 1]" },
    ]);
  });

  it("shows objects, strings, undefined and class instances", async () => {
    const results = await runner.run({
      code: `function shape(kind) {
        if (kind === "missing") return undefined;
        if (kind === "map") return new Map();
        if (kind === "fn") return () => 1;
        return { id: 1, title: "x" };
      }`,
      functionName: "shape",
      tests: [
        makeTest("object", ["object"], { id: 1, title: "y" }),
        makeTest("missing", ["missing"], null),
        makeTest("map", ["map"], {}),
        makeTest("fn", ["fn"], 1),
      ],
    });
    expect(reasons(results)).toEqual([
      'Expected {"id": 1, "title": "y"} but got {"id": 1, "title": "x"}',
      "Expected null but got undefined",
      "Expected {} but got an instance of Map",
      "Expected 1 but got a function",
    ]);
  });

  it("fails when an object has an extra key", async () => {
    const results = await runner.run({
      code: "function user() { return { name: 'Ada', admin: true }; }",
      functionName: "user",
      tests: [makeTest("t", [], { name: "Ada" })],
    });
    expect(results[0]?.passed).toBe(false);
  });

  it("cuts each value to 200 characters", async () => {
    const results = await runner.run({
      code: "function range(n) { return Array.from({ length: n }, (_, i) => i); }",
      functionName: "range",
      tests: [makeTest("t", [500], [])],
    });
    const [result] = results;
    expect(result?.passed).toBe(false);
    const reason = result && !result.passed ? result.reason : "";
    const shown = reason.replace("Expected [] but got ", "");
    expect(shown).toHaveLength(MAX_VALUE_LENGTH);
    expect(shown.endsWith("…")).toBe(true);
  });

  it("reports what the function threw", async () => {
    const results = await runner.run({
      code: `function fail(kind) {
        if (kind === "type") return null.length;
        if (kind === "custom") throw new RangeError("Too big");
        throw "boom";
      }`,
      functionName: "fail",
      tests: [
        makeTest("type", ["type"], 0),
        makeTest("custom", ["custom"], 0),
        makeTest("text", ["text"], 0),
      ],
    });
    expect(reasons(results)).toEqual([
      expect.stringMatching(/^Threw TypeError: /),
      "Threw RangeError: Too big",
      'Threw "boom"',
    ]);
  });

  it("reports a syntax error on every test", async () => {
    const results = await runner.run(
      addTodo("function addTodo(todos, title) { return [...todos, }"),
    );
    expect(results).toHaveLength(3);
    for (const reason of reasons(results)) expect(reason).toMatch(/^Threw SyntaxError: /);
  });

  it("reports a missing function on every test", async () => {
    for (const code of ["function addTask() {}", "const addTodo = 42;"]) {
      const results = await runner.run(addTodo(code));
      expect(reasons(results)).toEqual(Array(3).fill("No function named addTodo was found"));
    }
  });

  it("runs the code in strict mode", async () => {
    const results = await runner.run({
      code: "function sloppy() { undeclared = 1; return 1; }",
      functionName: "sloppy",
      tests: [makeTest("t", [], 1)],
    });
    expect(reasons(results)).toEqual([expect.stringMatching(/^Threw ReferenceError: /)]);
  });

  it("cannot fake a pass by replacing the built-ins the harness uses", async () => {
    const results = await runner.run({
      code: `JSON.parse = () => 0;
        Object.keys = () => [];
        function answer() { return 0; }`,
      functionName: "answer",
      tests: [makeTest("t", [], 42)],
    });
    expect(reasons(results)).toEqual(["Expected 42 but got 0"]);
  });
});

describe("a mutating solution", () => {
  it("passes the value tests and fails the immutability test", async () => {
    const results = await runner.run(
      addTodo(
        "function addTodo(todos, title) { todos.push({ title, done: false }); return todos; }",
      ),
    );
    expect(reasons(results)).toEqual([null, null, "Changed its input (argument 1)"]);
  });

  it("names the argument that changed", async () => {
    const results = await runner.run({
      code: "function merge(a, b) { b.x = 1; return { ...a, ...b }; }",
      functionName: "merge",
      tests: [makeTest("t", [{ y: 2 }, {}], { y: 2, x: 1 }, true)],
    });
    expect(reasons(results)).toEqual(["Changed its input (argument 2)"]);
  });
});

describe("code that never finishes (AC-3.4)", () => {
  const browserRunner = createRunner({ timeoutMs: RUN_TIMEOUT_MS.browser });
  const timeout = REASONS.timeout(RUN_TIMEOUT_MS.browser);

  it("stops with the timeout reason in under 4 seconds", async () => {
    expect(timeout).toBe("Stopped after 3 seconds: the code may contain an infinite loop");
    const started = Date.now();
    const results = await browserRunner.run(addTodo("function addTodo() { while (true) {} }"));
    expect(Date.now() - started).toBeLessThan(4_000);
    expect(reasons(results)).toEqual([timeout, timeout, timeout]);
  }, 10_000);

  it("cannot catch the interruption", async () => {
    const results = await browserRunner.run(
      addTodo("function addTodo() { try { while (true) {} } catch { return []; } }"),
    );
    expect(reasons(results)).toEqual([timeout, timeout, timeout]);
  }, 10_000);

  it("also stops when the loop runs at the top level", async () => {
    const results = await browserRunner.run(addTodo("for (;;) {} function addTodo() {}"));
    expect(reasons(results)).toEqual([timeout, timeout, timeout]);
  }, 10_000);

  it("uses the server limit in the API", () => {
    expect(REASONS.timeout(RUN_TIMEOUT_MS.server)).toBe(
      "Stopped after 2 seconds: the code may contain an infinite loop",
    );
  });
});

describe("isolation (AC-3.5)", () => {
  it.each(["window", "document", "fetch", "localStorage", "setTimeout"])(
    "fails code that uses %s",
    async (host) => {
      const results = await runner.run({
        code: `function probe() { ${host}.x; return 1; }`,
        functionName: "probe",
        tests: [makeTest("t", [], 1)],
      });
      expect(reasons(results)).toEqual([`Threw ReferenceError: '${host}' is not defined`]);
    },
  );

  it("fails code that loads a module with import()", async () => {
    const results = await runner.run({
      code: 'function readFile() { return import("node:fs").readFileSync("/etc/hosts", "utf8"); }',
      functionName: "readFile",
      tests: [makeTest("t", [], "")],
    });
    expect(reasons(results)).toEqual([expect.stringMatching(/^Threw TypeError: /)]);

    const promised = await runner.run({
      code: 'function loadModule() { return import("node:fs"); }',
      functionName: "loadModule",
      tests: [makeTest("t", [], {})],
    });
    expect(reasons(promised)).toEqual(["Expected {} but got an instance of Promise"]);
  });

  it("shares no state between two consecutive runs", async () => {
    const first = await runner.run({
      code: `globalThis.leak = 1;
        Array.prototype.leak = 1;
        JSON.stringify = () => "leak";
        function probe() { return 1; }`,
      functionName: "probe",
      tests: [makeTest("t", [], 1)],
    });
    expect(first[0]?.passed).toBe(true);

    const second = await runner.run({
      code: `function probe() {
        return [typeof globalThis.leak, typeof [].leak, JSON.stringify({ a: 1 })];
      }`,
      functionName: "probe",
      tests: [makeTest("t", [], ["undefined", "undefined", '{"a":1}'])],
    });
    expect(second[0]?.passed).toBe(true);
  });

  // The hog allocates 1 MB buffers, so it reaches 32 MB in a few dozen native
  // allocations, well within the 2 s time limit. Filling arrays element by element
  // took up to 25 s on CI runners shared with other test tasks, and concatenated
  // strings may share their storage instead of allocating it. The test timeout
  // covers the runner's recovery on those slow runners.
  it("limits memory to 32 MB and recovers for the next run", { timeout: 60_000 }, async () => {
    const results = await runner.run({
      code: `function hog() {
        const chunks = [];
        while (true) chunks.push(new ArrayBuffer(1 << 20));
      }`,
      functionName: "hog",
      tests: [makeTest("t", [], 0)],
    });
    expect(reasons(results)).toEqual(["Threw InternalError: out of memory"]);

    const next = await runner.run({
      code: "function one() { return 1; }",
      functionName: "one",
      tests: [makeTest("t", [], 1)],
    });
    expect(next[0]?.passed).toBe(true);
  });

  it("bounds the stack and recovers for the next run", async () => {
    const results = await runner.run({
      code: "function deep(n) { return deep(n + 1); }",
      functionName: "deep",
      tests: [makeTest("t", [0], 0)],
    });
    expect(reasons(results)).toEqual(["Threw InternalError: stack overflow"]);

    const viaToString = await runner.run({
      code: "function f() { const o = { toString() { return String(this); } }; return String(o); }",
      functionName: "f",
      tests: [makeTest("t", [], "")],
    });
    expect(reasons(viaToString)).toEqual(["Threw InternalError: stack overflow"]);
  });

  it("allows a few hundred nested calls", async () => {
    const results = await runner.run({
      code: "function depth(n) { return n === 0 ? 0 : 1 + depth(n - 1); }",
      functionName: "depth",
      tests: [makeTest("t", [500], 500)],
    });
    expect(results[0]?.passed).toBe(true);
  });

  it("reloads the WebAssembly module after the host stack overflows", async () => {
    const load = vi.fn(loadQuickJS);
    // A stack limit far above the host's lets the recursion overflow the host stack.
    const fragile = createRunner({
      timeoutMs: RUN_TIMEOUT_MS.server,
      stackBytes: 1024 * 1024,
      load,
    });
    const crashed = await fragile.run({
      code: "function f() { const o = { toString() { return String(this); } }; return String(o); }",
      functionName: "f",
      tests: [makeTest("a", [], ""), makeTest("b", [], "")],
    });
    expect(reasons(crashed)).toEqual([REASONS.crashed, REASONS.crashed]);

    const next = await fragile.run({
      code: "function one() { return 1; }",
      functionName: "one",
      tests: [makeTest("t", [], 1)],
    });
    expect(next[0]?.passed).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
