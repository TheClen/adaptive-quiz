import { REASONS, type RunInput, type TestResult } from "@ai-in-learning/core/runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RunnerMessage, RunRequest } from "./protocol.js";
import { BACKSTOP_MS, createRunnerClient, type RunnerWorker } from "./runnerClient.js";

const input: RunInput = {
  code: "function double(n) { return n * 2; }",
  functionName: "double",
  tests: [
    { id: "t1", description: "doubles 2", args: [2], expected: 4, checksImmutability: false },
    { id: "t2", description: "doubles 0", args: [0], expected: 0, checksImmutability: false },
  ],
};

const passing: readonly TestResult[] = [
  { testId: "t1", passed: true },
  { testId: "t2", passed: true },
];

/** A worker the test drives: it answers only when told to. */
class FakeWorker implements RunnerWorker {
  onmessage: ((event: MessageEvent<RunnerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly requests: RunRequest[] = [];
  terminated = false;

  postMessage(message: RunRequest): void {
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  send(message: RunnerMessage): void {
    this.onmessage?.(new MessageEvent("message", { data: message }));
  }

  /** Answers the last run request with `results`. */
  answer(results: readonly TestResult[]): void {
    const request = this.requests.at(-1);
    if (request === undefined) throw new Error("The worker received no run request");
    this.send({ type: "results", id: request.id, results });
  }

  crash(): void {
    this.onerror?.(new ErrorEvent("error"));
  }
}

function setUp() {
  const workers: FakeWorker[] = [];
  const client = createRunnerClient({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { client, workers };
}

/** Lets queued promise callbacks run, so a queued run reaches the worker. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

function failedWith(reason: string): TestResult[] {
  return input.tests.map((test) => ({ testId: test.id, passed: false, reason }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRunnerClient", () => {
  it("starts no worker until a session starts or a run is asked for", () => {
    const { client, workers } = setUp();
    expect(workers).toHaveLength(0);

    client.preload();
    client.preload();

    expect(workers).toHaveLength(1);
  });

  it("passes the worker's results through", async () => {
    const { client, workers } = setUp();
    client.preload();
    const [worker] = workers;
    worker?.send({ type: "ready" });

    const result = client.run(input);
    await flush();
    expect(worker?.requests).toEqual([{ type: "run", id: 1, input }]);
    worker?.answer(passing);

    await expect(result).resolves.toEqual(passing);
  });

  it("starts the worker on the first run when it was not preloaded", async () => {
    const { client, workers } = setUp();

    const result = client.run(input);
    await flush();
    expect(workers).toHaveLength(1);
    workers[0]?.send({ type: "ready" });
    workers[0]?.answer(passing);

    await expect(result).resolves.toEqual(passing);
  });

  it("terminates a silent worker after the backstop and fails every test (AC-3.4)", async () => {
    const { client, workers } = setUp();
    client.preload();
    workers[0]?.send({ type: "ready" });

    const result = client.run(input);
    let settled = false;
    void result.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual(
      failedWith("Stopped after 5 seconds: the code may contain an infinite loop"),
    );
    expect(workers[0]?.terminated).toBe(true);
    // A new worker starts right away, so the next run does not wait for it.
    expect(workers).toHaveLength(2);
  });

  it("runs on a working worker after the backstop recreated it", async () => {
    const { client, workers } = setUp();
    client.preload();
    workers[0]?.send({ type: "ready" });
    const stuck = client.run(input);
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS);
    await stuck;

    const [, fresh] = workers;
    fresh?.send({ type: "ready" });
    const result = client.run(input);
    await flush();
    fresh?.answer(passing);

    await expect(result).resolves.toEqual(passing);
    expect(workers).toHaveLength(2);
  });

  it("ignores results that a terminated worker sends late", async () => {
    const { client, workers } = setUp();
    client.preload();
    const [old] = workers;
    old?.send({ type: "ready" });
    const stuck = client.run(input);
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS);
    await stuck;

    const result = client.run(input);
    await flush();
    old?.answer(passing);
    const [, fresh] = workers;
    fresh?.send({ type: "ready" });
    const failing = failedWith("Expected 4 but got 3");
    fresh?.answer(failing);

    await expect(result).resolves.toEqual(failing);
  });

  it("counts the backstop from when the WebAssembly module is loaded", async () => {
    const { client, workers } = setUp();
    client.preload();
    const result = client.run(input);
    let settled = false;
    void result.then(() => (settled = true));

    // A slow download is not code that never stops.
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS * 3);
    expect(settled).toBe(false);
    workers[0]?.send({ type: "ready" });
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS);

    await expect(result).resolves.toEqual(failedWith(REASONS.timeout(BACKSTOP_MS)));
  });

  it("runs one at a time, and the backstop does not count the wait", async () => {
    const { client, workers } = setUp();
    client.preload();
    const [worker] = workers;
    worker?.send({ type: "ready" });

    const first = client.run(input);
    const second = client.run({ ...input, code: "function double(n) { return n + n; }" });
    await flush();
    expect(worker?.requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(BACKSTOP_MS - 1);
    worker?.answer(passing);
    await expect(first).resolves.toEqual(passing);
    await flush();
    expect(worker?.requests).toHaveLength(2);
    expect(worker?.requests[1]?.input.code).toBe("function double(n) { return n + n; }");

    await vi.advanceTimersByTimeAsync(BACKSTOP_MS - 1);
    worker?.answer(passing);
    await expect(second).resolves.toEqual(passing);
    expect(worker?.terminated).toBe(false);
  });

  it("fails the run and drops the worker when the module cannot load", async () => {
    const { client, workers } = setUp();
    client.preload();
    const result = client.run(input);
    await flush();
    workers[0]?.send({ type: "loadFailed" });

    await expect(result).resolves.toEqual(failedWith(REASONS.harness));
    expect(workers[0]?.terminated).toBe(true);

    // The next run tries again with a new worker.
    const retried = client.run(input);
    await flush();
    expect(workers).toHaveLength(2);
    workers[1]?.send({ type: "ready" });
    workers[1]?.answer(passing);
    await expect(retried).resolves.toEqual(passing);
  });

  it("fails the run and drops the worker when the worker errors", async () => {
    const { client, workers } = setUp();
    client.preload();
    const result = client.run(input);
    await flush();
    workers[0]?.crash();

    await expect(result).resolves.toEqual(failedWith(REASONS.harness));
    expect(workers[0]?.terminated).toBe(true);
  });

  it("stops the worker on dispose and fails the run in progress", async () => {
    const { client, workers } = setUp();
    client.preload();
    workers[0]?.send({ type: "ready" });
    const result = client.run(input);
    await flush();

    client.dispose();

    await expect(result).resolves.toEqual(failedWith(REASONS.harness));
    expect(workers[0]?.terminated).toBe(true);
  });
});
