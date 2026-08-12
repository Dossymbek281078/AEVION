import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `opentimestamps@0.4.x` declares `"main": "open-timestamps.js"` in its
      // package.json, but that file DOES NOT EXIST — the real entry is
      // `index.js`. Node tolerates this at runtime (falls back to index.js with
      // a DEP0128 warning), so prod works; Vite/esbuild is strict and hard-fails
      // with "Failed to resolve entry for package opentimestamps", reddening
      // every PR's backend CI deterministically. The `server.deps.inline` below
      // was not enough. Aliasing the bare specifier straight to the real entry
      // file resolves it for good.
      opentimestamps: fileURLToPath(
        new URL("./node_modules/opentimestamps/index.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    // Было 10 с — и этого не хватало. Замер 12.08.2026 на полном прогоне
    // (121 файл, 1523 теста): при 10 с падали ТРИ файла и 7–8 тестов, почти
    // все с «Test timed out in 10000ms»; при 30 с остаётся ОДИН файл и 2 теста.
    // То есть devhub-integrations — настоящий флак (ошибки утверждений, общая
    // очередь моков), а qtradeInternalCredit и tier3OgRoutes были чистыми
    // жертвами таймаута и с ним же лечатся.
    //
    // Признак, по которому это узнаётся: от прогона к прогону падает РАЗНЫЙ
    // набор, а сообщение всегда одно про таймаут. Изолированно те же три файла
    // дают 251/251. Списывать такое на «нагрузку» — способ годами держать
    // красный набор и перестать на него смотреть.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // `opentimestamps` (0.4.x, CJS, no clean exports map) intermittently trips
    // Vite's dep optimizer when several test files import it concurrently on a
    // cold cache — surfacing as "Failed to resolve entry for package
    // opentimestamps" and reddening CI on unrelated PRs. Inlining it routes the
    // package through Vite's transform pipeline instead of the optimizer, which
    // resolves it deterministically. Local runs already pass; this kills the
    // CI-only flake (opentimestamps.anchor / reconstruct.route / tier3OgRoutes).
    server: {
      deps: {
        inline: ["opentimestamps"],
      },
    },
  },
});
