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
    // 30 с, а не 10, И отдельный лимит для хуков.
    //
    // Замер 28.07: за день ТРИ файла краснели по таймауту, и каждый раз это
    // выглядело как настоящий дефект, а не как исчерпанный лимит —
    // `tier3OgRoutes` (10169–10695 мс), `qtradeInternalCredit` (15660 мс),
    // `qcoreaiPublicNoOwnerLeak` (хук, «Hook timed out in 10000ms», ронял ФАЙЛ
    // целиком и уводил все семь тестов в skip). Ни один из них не делает
    // тяжёлой работы: время уходит на `await import("../src/routes/…")`, который
    // тянет дерево зависимостей маршрутов. В одиночку все три — доли секунды.
    //
    // Смысл таймаута — поймать зависание, и для этого 30 с не хуже 10; зато
    // исчезает целый класс ложной красноты. Обход показал ещё ПЯТЬ файлов с
    // тяжёлыми динамическими импортами и без своего лимита
    // (`qsignV2.dilithium` — 12 импортов, `qsignV2.sentry` — 7,
    // `provisioning.sendEmail`, `qcoreV35`, тот же `qtradeInternalCredit`), то
    // есть чинить по одному значило бы ждать следующего.
    //
    // `hookTimeout` задаётся отдельно НЕ для симметрии: у vitest это независимый
    // лимит, и `testTimeout` на хуки не распространяется — на этом я и попался
    // со своим `beforeAll`.
    // Число воркеров ограничено ЯВНО. На машине 32 ядра, и vitest по умолчанию
    // берёт их почти все — а коммит памяти здесь и так на пределе (CLAUDE.md §6:
    // 98.7 из 97.2 ГБ при трёх сборках). Под такой нагрузкой отдельные файлы шли
    // в 30+ раз дольше, чем в одиночку, и падали по таймауту.
    //
    // ЗАМЕР 28.07, вечер: при значении по умолчанию полный прогон давал 1-2
    // падения (qcoreaiPublicNoOwnerLeak, tier3OgRoutes) — причём с сообщением
    // «timed out in 30000ms», то есть поднятый лимит УЖЕ применялся и не помогал.
    // С шестью воркерами — четыре прогона подряд по 1515 тестов без падений,
    // 17 с по стенным часам.
    //
    // Это НЕ доказательство: четыре прогона мало для мигающего набора. Но
    // механизм понятен, и дальнейшее поднятие лимитов бессмысленно — 60 с дали бы
    // ту же картину, потому что дело в нехватке ресурса, а не в пороге.
    maxWorkers: 6,
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
