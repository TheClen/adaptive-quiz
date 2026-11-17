# ADR 0005 — Run exercise code in QuickJS (WebAssembly)

- Status: Accepted
- Date: 2026-11-17

## Context

Spec 001 includes code exercises: the visitor writes a JavaScript function, and tests check it. The same tests also prove that each exercise is solvable before it is shown. Code therefore runs in two places:

- **In the browser**, for visitor code, every time they click "Run tests" or submit (AC-3.2, AC-3.3).
- **In the API**, for the model-generated reference solution, before an exercise is returned (AC-3.6), and for the visitor's submitted code, so that the AI reviewer sees test results computed by the server rather than reported by the client ([plan 001 §7.2, §10](../../specs/001-adaptive-quiz-mvp/plan.md#72-post-apiquizcode-review)).

None of this code can be trusted. The visitor can type anything, and the model can produce anything. The constraints are:

- Code that never finishes must stop after a few seconds, and the page must stay responsive (AC-3.4).
- Code must not read or change anything outside the exercise: no DOM, network, storage or timers (AC-3.5).
- The API runs as stateless Vercel Functions ([ADR 0002](0002-serverless-on-vercel.md)): no native addons that need a custom build, no long-lived worker process.
- "Solvable" must mean solvable in the environment the visitor actually uses. If the server and the browser run code differently, an exercise could pass on the server and fail in the browser, or the other way round.

## Decision drivers

- A real isolation boundary on both the server and the browser
- One engine, so the server and the browser agree on every result
- Reliable time and memory limits on untrusted code
- Runs on Vercel Functions and in a browser Web Worker without native dependencies
- Download size and start-up cost acceptable for the quiz

## Considered options

1. **Native engines.** In the browser, a sandboxed `<iframe>` running the code inside a Web Worker. In the API, Node's `vm` module.
2. **QuickJS compiled to WebAssembly** (`quickjs-emscripten`), with the same test harness in a browser Web Worker and in the API.

## Decision

Option 2. Exercise code, whether written by the visitor or by the model, runs only inside a QuickJS interpreter compiled to WebAssembly, through `quickjs-emscripten`. One test harness in `@ai-in-learning/core/runner` is used in both places:

| | Browser (visitor code) | API (reference solution, AC-3.6; visitor code for the review) |
| --- | --- | --- |
| Host | Dedicated Web Worker | Vercel Function |
| Time limit | Interrupt handler, 3 s per run | Interrupt handler, 2 s per check |
| Backstop | The main thread terminates and recreates the worker after 5 s | The function's `maxDuration` |
| Memory | 32 MB runtime limit, bounded stack | Same |

For each run, the harness creates a fresh QuickJS runtime and context, evaluates `"use strict";` followed by the code, then calls the named function once per test, passing arguments in as JSON. The context exposes no host objects: no `window`, `document`, `fetch`, storage, `import()` or timers. Nothing is shared between runs.

## Rationale

- **One engine, one answer.** The reference solution is checked by the same interpreter, harness and limits that later run the visitor's code. "Solvable" on the server means solvable in the browser.
- **A real boundary on both sides.** Node's `vm` module is explicitly not a security mechanism: code inside it can reach the host process. A sandboxed iframe protects only the browser and does nothing for the server. QuickJS runs inside WebAssembly memory and can only call what the host chooses to expose, which here is nothing.
- **Enforceable limits.** QuickJS checks an interrupt handler while it executes, so an infinite loop stops at the deadline instead of blocking the thread. Memory and stack limits are set per runtime. Running the interpreter in a Web Worker keeps the page responsive even while a run is stuck, and terminating the worker is a last-resort backstop.
- **Portable.** It is plain WebAssembly and JavaScript, with no native addon, so it runs on Vercel Functions, in a browser Web Worker, and on Node for tests.
- **Acceptable cost.** The WebAssembly build is about 1 MB. It is lazy-loaded when a session starts, well before the first exercise at position 4.

## Consequences

- Exercise code runs on a different engine from the visitor's browser. QuickJS supports modern ECMAScript, and the static checks in plan §8.4 keep exercises away from host-specific APIs, but results can differ from V8 in rare edge cases, such as error message text. Failure reasons are fixed templates, so they do not depend on the engine's own messages.
- Exercises can only test synchronous pure functions with JSON arguments and results. This fits AC-3.7, but rules out exercises that render React components or use `async` code. Such exercises would need a new ADR.
- The quiz bundle grows by about 1 MB of WebAssembly, loaded lazily. The quiz CSP must allow `'wasm-unsafe-eval'` (plan §14).
- The API bundle must ship the WebAssembly file, and the function must load it at cold start. This is verified on the first deployment.
- `quickjs-emscripten` becomes a dependency of `@ai-in-learning/core/runner`, and must be kept up to date like any other sandbox: an escape in QuickJS would affect both the browser and the server.
- The runner must be tested on Node with the real QuickJS build, including an infinite loop, attempts to reach host objects, and isolation between consecutive runs (task T08).

## Revisit when

- A future spec needs exercises that render React components, call hooks, or run asynchronous code
- QuickJS lags behind an ECMAScript feature the exercises need
- A security advisory affects QuickJS or `quickjs-emscripten` and no fixed release is available
- The WebAssembly download measurably hurts the time to the first exercise
