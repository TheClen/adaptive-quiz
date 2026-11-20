import react from "@vitejs/plugin-react";
import { configDefaults, defineProject, mergeConfig } from "vitest/config";

import { sharedProjectConfig } from "../../vitest.shared.ts";

export default mergeConfig(
  sharedProjectConfig,
  defineProject({
    plugins: [react()],
    test: {
      name: "quiz",
      environment: "jsdom",
      setupFiles: ["./src/testing/setup.ts"],
      // Playwright runs the end-to-end specs (`test:e2e`).
      exclude: [...configDefaults.exclude, "e2e/**"],
    },
  }),
);
