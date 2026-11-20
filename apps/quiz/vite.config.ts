import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

import vercelConfig from "./vercel.json" with { type: "json" };

/** Port of the local API server (`apps/api/src/dev.ts`). */
const API_DEV_PORT = 8787;

/**
 * The security headers Vercel sends with every file (plan §14). `vite preview` sends
 * the same ones, so the built app can be checked under the production CSP. The dev
 * server does not: React Refresh and Vite's style injection need inline code.
 */
const productionHeaders = Object.fromEntries(
  vercelConfig.headers
    .filter((rule) => rule.source === "/(.*)")
    .flatMap((rule) => rule.headers.map(({ key, value }) => [key, value] as const)),
);

export default defineConfig({
  plugins: [react()],
  // Workspace packages resolve to their `src/` through the `source` condition.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // The runner worker is a module worker. ES output keeps the QuickJS variants it never
  // uses as separate chunks, instead of inlining them all into the worker (plan §9.2).
  worker: { format: "es" },
  server: {
    // Same origin as in production, where Vercel rewrites `/api/*` (plan §14).
    proxy: { "/api": `http://localhost:${String(API_DEV_PORT)}` },
  },
  // The preview server also reuses the proxy above (`preview.proxy` defaults to it).
  preview: { headers: productionHeaders },
});
