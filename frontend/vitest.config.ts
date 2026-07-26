import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    /* The default 5s is measured per test but competes with every other file running in
       parallel. A jsdom render that finishes in 20ms alone was intermittently timing out
       in the full suite on a loaded machine — a red run that says nothing about the code.
       Raised so a timeout means a hang, not a busy CPU. */
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
