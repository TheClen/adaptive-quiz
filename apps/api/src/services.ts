import {
  createAnthropicModelClient,
  createUpstashRateLimiter,
  type ModelClient,
  type RateLimiter,
} from "@ai-in-learning/core/server";

import type { Env } from "./env.js";

/** What the routes need from the outside world. Tests replace each one with a fake. */
export interface Services {
  readonly model: ModelClient;
  readonly rateLimiter: RateLimiter;
  /** The HMAC key for exercise tokens (plan §7.2). */
  readonly signingSecret: string;
}

/**
 * The production services: the Anthropic adapter and the Upstash limiter. Built
 * once per cold start; they hold configuration only, no request data (principle V).
 */
export function createServices(env: Env): Services {
  return {
    model: createAnthropicModelClient({ apiKey: env.ANTHROPIC_API_KEY }),
    rateLimiter: createUpstashRateLimiter({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    signingSecret: env.QUIZ_SIGNING_SECRET,
  };
}
