/**
 * Diagnostic build: Next with webpack instead of Turbopack. NOT what ships —
 * production stays on Turbopack (`npm run build`).
 *
 * What it is for: webpack type-checks route entries and Turbopack does not, so
 * this build is the only thing that catches a page whose params are typed in a
 * shape Next 16 rejects. Eight such pages had accumulated by 28.07.2026 with CI
 * fully green. (The gate now also runs `next typegen && tsc --noEmit`, which
 * catches the same class in seconds — this build is the backstop.)
 *
 * What it is NOT for: making pages lighter. A note from 28.07.2026 claimed
 * webpack cut the shelf's blocking JavaScript from 5569 KB to 1018 KB. Re-run
 * 10.08.2026 with one instrument on both builds (scripts/page-weight.mjs), that
 * does not reproduce — the two figures had been measured differently, webpack's
 * blocking set against Turbopack's whole download:
 *
 *   blocking <script>   /devhub  Turbopack 2494 KB / 16   webpack 2693 KB / 16
 *   everything loaded   /devhub  Turbopack 6013 KB / 54   webpack 5706 KB / 78
 *
 * The bundlers are within a few per cent of each other, in opposite directions.
 * There is no page-weight reason to switch, and the guard spec e2e/page-weight
 * keeps the real numbers honest from here on.
 *
 * Two settings are not optional, both learned the hard way:
 *
 *   - Node's default heap is too small for this app under webpack: the build
 *     died with "Reached heap limit". The size is derived from the machine
 *     rather than pinned at 8 GB, because a pinned 8 GB is the whole of a
 *     Vercel build container and would trade a heap error for an OOM kill.
 *   - Sentry's source-map upload hangs this build (socket hang ups, then
 *     endless retries). It is disabled only when no auth token is configured —
 *     which is the case that hung. Where a token exists the upload runs, so a
 *     deploy keeps its source maps instead of silently losing them.
 *
 * Kept as a script rather than a shell one-liner because `VAR=value cmd` in an
 * npm script does not work on Windows, and this repo is developed there.
 */

import { spawn } from "node:child_process";
import os from "node:os";

const MB = 1024 * 1024;
// Three quarters of the machine, floored at 4 GB (below that the build dies)
// and capped at 8 GB (above that it stops helping). Vercel's 8 GB container
// lands on 6 GB, this laptop and CI runners on 8.
const heapMb = Math.min(8192, Math.max(4096, Math.floor((os.totalmem() / MB) * 0.75)));

const hasSentryToken = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());

// `--analyze` turns on @next/bundle-analyzer, which next.config.ts wires by
// env. It maps webpack chunks, so it answers "what is inside this build" — for
// the shipping build use `npm run analyze`, which maps Turbopack's.
const args = process.argv.slice(2);
const analyze = args.includes("--analyze");
const nextArgs = args.filter((a) => a !== "--analyze");

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--max-old-space-size=${heapMb}`]
    .filter(Boolean)
    .join(" "),
};

if (analyze) {
  env.ANALYZE = "true";
}

if (!hasSentryToken) {
  env.SENTRY_DISABLE_AUTO_UPLOAD = "true";
}

console.log(
  `[build:webpack] heap ${heapMb} MB (machine ${Math.round(os.totalmem() / MB)} MB), ` +
    `Sentry source-map upload ${hasSentryToken ? "on" : "off (no SENTRY_AUTH_TOKEN)"}` +
    (analyze ? ", bundle analyzer on" : ""),
);

const child = spawn(
  "npx",
  ["next", "build", "--webpack", ...nextArgs],
  {
    stdio: "inherit",
    // Windows needs a shell to launch npx (it is a .cmd), and Node refuses to
    // spawn one without this since v20 — the failure is a bare `EINVAL`.
    shell: process.platform === "win32",
    env,
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
