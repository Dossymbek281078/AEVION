// Config for the on-demand benchmarks in bench/ — not the test suite.
//
// They are kept out of the suite's test glob because each one plays hundreds of
// real games and takes minutes. Vitest has no CLI flag to add an include
// pattern (`--include` is not a vitest option), so pointing at the file by path
// cannot work on its own — it needs a config whose include covers it:
//
//   npx vitest run --config vitest.bench.config.ts
//
// Node environment and no setup file, for the same reason as
// vitest.local-nosetup.ts: the jsdom setup pulls in @testing-library/react,
// whose peer @testing-library/dom is missing from package.json.
//
// (Line comments on purpose — a block comment cannot hold a glob like
// "src/ ** / *.test.ts" without the "*/" inside it closing the comment early.)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["bench/**/*.bench.ts"],
    css: false,
    testTimeout: 3_000_000,
  },
});
