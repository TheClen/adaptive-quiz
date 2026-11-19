import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

/** Port of the local API server (`apps/api/src/dev.ts`). */
const API_DEV_PORT = 8787;

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
});
