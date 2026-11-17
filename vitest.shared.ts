import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineProject } from "vitest/config";

/**
 * Settings shared by every Vitest project. Workspace packages resolve through
 * their `source` export condition, so tests run against `src/` without a build.
 */
export const sharedProjectConfig = defineProject({
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
});
