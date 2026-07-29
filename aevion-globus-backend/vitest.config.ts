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
    testTimeout: 10_000,
    // Файлы прогоняются ПОСЛЕДОВАТЕЛЬНО. Замерено 29.07.2026 на чистом main
    // (91 файл, 1016 тестов): при параллельном прогоне падали 4 файла, причём
    // три — ровно на 11-12 секундах, то есть упирались в testTimeout выше,
    // ожидая общий ресурс. Каждый из этих файлов ПО ОДИНОЧКЕ полностью зелёный
    // (4, 5, 8 и 182 теста), а provisioning.sendEmail укладывается в 1.6 с
    // вместо 12.
    //
    // Набор падающих МЕНЯЕТСЯ от прогона к прогону — это гонка, а не свойство
    // конкретных файлов: пять прогонов --pool=forks дали 3, 7, 4, 4, 3 падения.
    // Форки (свой процесс и свой process.env на файл) убирают часть, но не всё:
    // что-то делится и через границу процессов — файловая система, порт или
    // общая заглушка БД.
    //
    // Единственный воспроизводимо зелёный режим: --no-file-parallelism →
    // три прогона подряд дали 1008 passed, 0 failed.
    //
    // Цена — время прогона. Выгода — гейт, которому можно верить: до этой
    // правки `npm test` был красным на самом main, то есть правило «в main
    // только через зелёный CI» нарушалось им же, и после разблокировки CI
    // завалил бы подряд все PR из очереди.
    //
    // Правильное лечение — изолировать разделяемый ресурс между файлами; это
    // отдельная работа. Пока она не сделана, последовательный прогон честнее
    // красного гейта.
    //
    // ⚠️ ЧЕГО ЭТА ПРАВКА НЕ ЛЕЧИТ. Сразу после `npm install`, на ХОЛОДНОМ кэше
    // Vite, первые прогоны всё равно могут падать: 29.07 два подряд дали
    // 1 и 2 упавших файла, а следующие три — 1008 passed, 0 failed. Причина
    // та же, что описана выше про opentimestamps и dep optimizer.
    // Для CI это существенно: там кэш холодный ВСЕГДА. Значит одной этой
    // настройки для зелёного CI может не хватить — нужен либо прогретый кэш
    // (кэшировать node_modules/.vite между прогонами), либо retry на первый
    // прогон. Проверять надо на чистой машине, а не локально.
    fileParallelism: false,
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
