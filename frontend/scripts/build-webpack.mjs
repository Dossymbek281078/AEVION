/**
 * Builds the app with webpack instead of Turbopack.
 *
 * Why anyone would: measured 28.07.2026 on the same commit, the DevHub shelf
 * has to load 1018 KB in 15 files before it can respond under webpack, against
 * 5569 KB in 55 files under Turbopack — and the 1.3 MB translation dictionary
 * stays out of the blocking set entirely. At 1.6 Mbps that is roughly twenty
 * seconds of a first visit.
 *
 * Two settings are not optional here, both learned the hard way:
 *   - Sentry's source-map upload hangs this build (five socket hang ups, then
 *     retries forever), so it is disabled.
 *   - Node's default heap is too small: the build died with "Reached heap
 *     limit" until given 8 GB.
 *
 * Kept as a script rather than a shell one-liner because `VAR=value cmd` in an
 * npm script does not work on Windows, and this repo is developed there.
 */

import { spawn } from "node:child_process";

const child = spawn(
  "npx",
  ["next", "build", "--webpack"],
  {
    stdio: "inherit",
    // Windows needs a shell to launch npx (it is a .cmd), and Node refuses to
    // spawn one without this since v20 — the failure is a bare `EINVAL`.
    shell: process.platform === "win32",
    env: {
      ...process.env,
      SENTRY_DISABLE_AUTO_UPLOAD: "true",
      SENTRY_AUTH_TOKEN: "",
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=8192"].filter(Boolean).join(" "),
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
