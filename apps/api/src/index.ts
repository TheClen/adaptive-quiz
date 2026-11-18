/**
 * Vercel entry (plan §14): the Hono framework preset serves the default export.
 * The environment is parsed once per cold start.
 */
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const app = createApp({ env: loadEnv(process.env) });

export default app;
