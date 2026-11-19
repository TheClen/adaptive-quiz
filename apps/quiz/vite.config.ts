import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

/** Port of the local API server (`apps/api/src/dev.ts`). */
const API_DEV_PORT = 8787;

export default defineConfig({
  plugins: [react()],
  // Workspace packages resolve to their `src/` through the `source` condition.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  server: {
    // Same origin as in production, where Vercel rewrites `/api/*` (plan §14).
    proxy: { "/api": `http://localhost:${String(API_DEV_PORT)}` },
  },
});
