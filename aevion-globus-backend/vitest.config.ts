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
    // 30 с, не 10. Замер 10.08.2026: `provisioning.sendEmail.test.ts` в
    // одиночку проходит за 530 мс, а в общем прогоне на этой машине занял
    // 31.5 с и упал по таймауту — вместе с `qtradeInternalCredit` (31.6 с) и
    // `tier3OgRoutes` (21.5 с). Причина внешняя: параллельные сессии держали
    // две сборки Next (9.3 и 7.5 ГБ), свободной памяти оставалось 14 ГБ при
    // потребности 18. Логика тестов при этом верна — они зелёные и по одному,
    // и на ненагруженной машине.
    //
    // Здесь это не мелочь стиля: набор, который краснеет от соседней сборки,
    // перестают читать, и настоящая регрессия тонет среди мнимых. Порог всё
    // ещё ограничен — зависший тест упрётся в него, просто не раньше времени.
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
