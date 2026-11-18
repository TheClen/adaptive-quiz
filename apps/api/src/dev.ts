/**
 * Local development server (plan §4): `pnpm --filter api dev`. Variables come
 * from `apps/api/.env` when it exists (see `.env.example`).
 */
import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

/** The quiz app's Vite proxy forwards `/api/*` here. */
const PORT = 8787;

const env = loadEnv(process.env);
if (!env.ok) {
  console.warn(
    `Missing or malformed variables: ${env.invalidVariables.join(", ")}. Every request will return "internal".`,
  );
}

serve({ fetch: createApp({ env }).fetch, port: PORT }, (info) => {
  console.log(`API listening on http://localhost:${String(info.port)}`);
});
