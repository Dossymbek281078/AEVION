/* Vitest config for the pure-logic tests, without the jsdom setup file.

   Why this exists: vitest.config.ts loads vitest.setup.ts, which imports
   @testing-library/react. That package is a peer-dependency consumer of
   @testing-library/dom, and @testing-library/dom is in neither package.json
   nor the lockfile — so every frontend test file fails to load locally with
   "Cannot find module '@testing-library/dom'", including tests that never
   touch the DOM.

   The chess bot tests (src/app/cyberchess/**) are pure functions over chess.js
   and need no DOM at all, so they run here:

     npx vitest run --config vitest.local-nosetup.ts src/app/cyberchess

   Note that CI does not run frontend tests at all today — the Frontend job in
   ci.yml is `next build` plus the i18n parity check — so this file is
   currently the only way these tests get executed anywhere. Once
   @testing-library/dom is added as a devDependency, the standard config works
   and this one can go. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"], css: false },
});
