/**
 * Server-only entry: model adapter, error mapping and prompts (plan §4, §8, §11). It
 * depends on the Anthropic SDK and must never reach a browser bundle.
 */
export * from "./anthropic-client.js";
export * from "./model-client.js";
export * from "./model-config.js";
export * from "./model-errors.js";
export * from "./prompts/index.js";
