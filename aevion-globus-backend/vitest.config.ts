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
    // 30 секунд, а не 10. Замерено 11.08.2026 тремя полными прогонами подряд:
    // каждый раз падало 3-5 файлов, КАЖДЫЙ раз разных, и все — с «Test timed
    // out in 10000ms», ни одной ошибки утверждения. В изоляции те же файлы
    // проходят за секунду.
    //
    // Причина не в тестах: многие делают `await import("../src/routes/…")`
    // внутри тела (чтобы задать env до импорта), и время импорта тяжёлого
    // роутера засчитывается в таймаут теста. На машине, где параллельно идут
    // сборки других сессий, один такой импорт занимает больше десяти секунд —
    // суммарное время трансформации в этих прогонах доходило до 350-570 с.
    //
    // Цена решения: настоящий подвисший тест теперь падает не через 10 секунд,
    // а через 30. Это дешевле, чем красный прогон, которому перестают верить:
    // «тесты зелёные» как гейт не работает, если зелёный выпадает через раз.
    testTimeout: 30_000,
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
