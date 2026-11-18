/**
 * Test-only entry (`@ai-in-learning/core/server/testing`). It has only the
 * `source` export condition and is excluded from the build, so production code
 * cannot import it.
 */
export * from "./fake-model-client.js";
