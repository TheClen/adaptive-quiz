import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";

import type { ModelClient, ModelRequest, ModelResult, ModelUsage } from "./model-client.js";
import { MODEL_MAX_RETRIES, MODEL_ROUTES } from "./model-config.js";
import { mapModelError } from "./model-errors.js";

export interface AnthropicModelClientOptions {
  readonly apiKey: string;
  /** Replaces the HTTP layer. Tests use it so they never reach the API (principle VI). */
  readonly fetch?: typeof fetch;
}

/**
 * The SDK's Zod format throws when the output does not match the schema
 * (including JSON cut short). This variant returns `null` instead, so invalid
 * output reaches the `parsed_output` guard rather than looking like an
 * upstream failure.
 */
function nullWhenInvalid<T>(
  format: AutoParseableOutputFormat<T>,
): AutoParseableOutputFormat<T | null> {
  return {
    ...format,
    parse: (content) => {
      try {
        return format.parse(content);
      } catch {
        return null;
      }
    },
  };
}

/** Builds the request body. Every parameter comes from `MODEL_ROUTES` (plan §8.2). */
function buildMessageParams<T>(request: ModelRequest<T>) {
  const config = MODEL_ROUTES[request.route];
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    // Thinking stays on; `max_tokens` leaves room for it. No sampling parameters
    // and no `fallbacks`: Claude Haiku 5.5 rejects both.
    thinking: { type: "adaptive" },
    output_config: {
      effort: config.effort,
      format: nullWhenInvalid(zodOutputFormat(request.schema)),
    },
    system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
    messages: request.messages.map(({ role, content }) => ({ role, content })),
  } satisfies Anthropic.MessageCreateParamsNonStreaming;
}

function toUsage(usage: Anthropic.Usage): ModelUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** The Anthropic adapter: `messages.parse()` with a Zod output format. */
export function createAnthropicModelClient(options: AnthropicModelClientOptions): ModelClient {
  const sdk = new Anthropic({
    apiKey: options.apiKey,
    maxRetries: MODEL_MAX_RETRIES,
    // Pinned so `ANTHROPIC_LOG=debug` cannot log request bodies (plan §11.4).
    logLevel: "warn",
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  return {
    async generate<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
      const { timeoutMs } = MODEL_ROUTES[request.route];
      let message;
      try {
        message = await sdk.messages.parse(buildMessageParams(request), { timeout: timeoutMs });
      } catch (error) {
        throw mapModelError(error);
      }

      const model = message.model;
      const usage = toUsage(message.usage);
      if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
        return { ok: false, reason: message.stop_reason, model, usage };
      }
      if (message.stop_reason !== "end_turn" || message.parsed_output === null) {
        return { ok: false, reason: "invalid_output", model, usage };
      }
      return { ok: true, output: message.parsed_output, model, usage };
    },
  };
}
