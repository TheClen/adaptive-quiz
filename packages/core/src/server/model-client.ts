import type { z } from "zod";

import type { ModelRoute } from "./model-config.js";

/** One turn of the conversation sent to the model. Text only. */
export interface ModelMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface ModelRequest<T> {
  /** Selects the fixed parameters in `MODEL_ROUTES`. */
  readonly route: ModelRoute;
  /** Static per topic and kind, so the API can cache it. */
  readonly system: string;
  readonly messages: readonly ModelMessage[];
  /** The draft schema. The output is parsed and validated against it. */
  readonly schema: z.ZodType<T>;
}

/** Token counts from the response, for the request log (plan §11.4). */
export interface ModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
}

/**
 * Why a response was not usable. Each one counts as an invalid draft: the
 * caller may retry once, then reports `generation_failed` (plan §8.4).
 */
export type ModelOutputFailure = "refusal" | "max_tokens" | "invalid_output";

export type ModelResult<T> =
  | { readonly ok: true; readonly output: T; readonly model: string; readonly usage: ModelUsage }
  | {
      readonly ok: false;
      readonly reason: ModelOutputFailure;
      readonly model: string;
      readonly usage: ModelUsage;
    };

/**
 * The only way `core/server` reaches a model. Upstream failures (timeouts,
 * rate limits, spend limits, configuration errors) are thrown as `ModelError`;
 * unusable output is returned as a failed `ModelResult`.
 */
export interface ModelClient {
  generate<T>(request: ModelRequest<T>): Promise<ModelResult<T>>;
}
