/**
 * Vercel entry (plan §14). The Hono framework preset deploys the compiled
 * `dist/index.js` (`outputDirectory` in `vercel.json`) and serves its default
 * export. The preset picks as entrypoint the first file named `app`, `index` or
 * `server` that imports "hono". So this file imports `Hono` itself (kept in the
 * output by `verbatimModuleSyntax`), and no other file in `src/` takes one of
 * those names. The environment is parsed once per cold start.
 */
import { Hono } from "hono";

import { type AppBindings, createApp } from "./create-app.js";
import { loadEnv } from "./env.js";

/**
 * Function settings, read by the preset from this file. A `functions` entry in
 * `vercel.json` does not reach a framework-preset function.
 */
export const config = { maxDuration: 60 };

const app: Hono<AppBindings> = createApp({ env: loadEnv(process.env) });

export default app;
