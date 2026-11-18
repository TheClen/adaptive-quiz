/**
 * Model call parameters, one set per route (plan §8.1, §8.2). The server owns
 * every parameter; nothing here comes from the client (principle III).
 */

/** The routes that call the model. Each one has its own fixed parameters. */
export type ModelRoute = "choice" | "code" | "review";

export interface ModelRouteConfig {
  readonly model: string;
  readonly maxTokens: number;
  readonly effort: "low" | "medium";
  /** Per-request timeout in milliseconds, for each attempt. */
  readonly timeoutMs: number;
}

/**
 * Claude Haiku 5.5 for every route (plan §8.1). Moving a route to another model
 * is a one-line change here, and needs a plan amendment first.
 */
export const MODEL_ROUTES = {
  choice: { model: "claude-haiku-5-5", maxTokens: 8_000, effort: "medium", timeoutMs: 20_000 },
  code: { model: "claude-haiku-5-5", maxTokens: 12_000, effort: "medium", timeoutMs: 25_000 },
  review: { model: "claude-haiku-5-5", maxTokens: 3_000, effort: "low", timeoutMs: 15_000 },
} as const satisfies Record<ModelRoute, ModelRouteConfig>;

/** SDK retries for transient errors (429, 5xx, 529, connection). */
export const MODEL_MAX_RETRIES = 1;
