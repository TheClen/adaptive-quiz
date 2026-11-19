import react from "@vitejs/plugin-react";
import { defineProject, mergeConfig } from "vitest/config";

import { sharedProjectConfig } from "../../vitest.shared.ts";

export default mergeConfig(
  sharedProjectConfig,
  defineProject({
    plugins: [react()],
    test: {
      name: "quiz",
      environment: "jsdom",
      setupFiles: ["./src/testing/setup.ts"],
    },
  }),
);
