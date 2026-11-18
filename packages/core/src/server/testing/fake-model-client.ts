import type {
  ModelClient,
  ModelOutputFailure,
  ModelRequest,
  ModelResult,
  ModelUsage,
} from "../model-client.js";
import { MODEL_ROUTES } from "../model-config.js";
import type { ModelError } from "../model-errors.js";

/** What the fake answers to one call, in order. */
export type FakeModelStep =
  /** A raw draft. It is validated against the request schema, like the real adapter does. */
  | { readonly output: unknown }
  | { readonly failure: ModelOutputFailure }
  | { readonly error: ModelError };

const NO_USAGE: ModelUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
};

/**
 * A scripted `ModelClient` for tests: it answers each call with the next step
 * and records every request. It throws when called more often than scripted.
 */
export class FakeModelClient implements ModelClient {
  readonly requests: ModelRequest<unknown>[] = [];
  readonly #steps: FakeModelStep[];

  constructor(steps: readonly FakeModelStep[]) {
    this.#steps = [...steps];
  }

  get callCount(): number {
    return this.requests.length;
  }

  generate<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    this.requests.push(request);
    const step = this.#steps.shift();
    if (step === undefined) {
      return Promise.reject(
        new Error(`FakeModelClient: no step scripted for call ${String(this.callCount)}`),
      );
    }
    if ("error" in step) {
      return Promise.reject(step.error);
    }

    const model = MODEL_ROUTES[request.route].model;
    if ("failure" in step) {
      return Promise.resolve({ ok: false, reason: step.failure, model, usage: NO_USAGE });
    }
    const parsed = request.schema.safeParse(step.output);
    return Promise.resolve(
      parsed.success
        ? { ok: true, output: parsed.data, model, usage: NO_USAGE }
        : { ok: false, reason: "invalid_output", model, usage: NO_USAGE },
    );
  }
}
