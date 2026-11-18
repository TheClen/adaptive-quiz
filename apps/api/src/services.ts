import {
  createAnthropicModelClient,
  createUpstashRateLimiter,
  type ModelClient,
  type RateLimiter,
} from "@ai-in-learning/core/server";
import { createRunner, RUN_TIMEOUT_MS, type Runner } from "@ai-in-learning/core/runner";

import type { Env } from "./env.js";

/** What the routes need from the outside world. Tests replace each one with a fake. */
export interface Services {
  readonly model: ModelClient;
  readonly rateLimiter: RateLimiter;
  /** Runs reference solutions and submitted code in QuickJS (plan §9.2, §9.3). */
  readonly runner: Runner;
  /** The HMAC key for exercise tokens (plan §7.2). */
  readonly signingSecret: string;
}

/**
 * The production services: the Anthropic adapter, the Upstash limiter and the
 * QuickJS runner. Built once per cold start; they hold configuration and the
 * WebAssembly module only, no request data (principle V). The runner loads QuickJS
 * on its first run, so a cold start that serves no code exercise does not pay for it.
 */
export function createServices(env: Env): Services {
  return {
    model: createAnthropicModelClient({ apiKey: env.ANTHROPIC_API_KEY }),
    rateLimiter: createUpstashRateLimiter({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    runner: createRunner({ timeoutMs: RUN_TIMEOUT_MS.server }),
    signingSecret: env.QUIZ_SIGNING_SECRET,
  };
}
