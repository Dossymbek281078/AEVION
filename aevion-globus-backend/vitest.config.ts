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
    // ЦЕНА, ЗАМЕРЕНА 29.07 на одном дереве, по два прогона на режим:
    //   параллельно     17.0 / 16.9 с — но 4 и 3 падения (флак);
    //   последовательно 78.5 / 73.9 с — 1008 passed, оба раза.
    // То есть зелёный гейт стоит примерно минуту на прогон. Против красного
    // CI, который валит подряд все PR, это дёшево.
    //
    // Выгода — гейт, которому можно верить: до этой
    // правки `npm test` был красным на самом main, то есть правило «в main
    // только через зелёный CI» нарушалось им же, и после разблокировки CI
    // завалил бы подряд все PR из очереди.
    //
    // ЧТО ИМЕННО ДЕЛИТСЯ (найдено 29.07): не файлы и не порты, а СОСТОЯНИЕ
    // МОДУЛЕЙ внутри процесса. Каталоги данных изолированы (mkdtempSync,
    // process.pid), а вот модуль qtrade держит accounts/operations в
    // переменных на всю жизнь процесса — об этом прямо написано в
    // tests/qtradeInternalCredit.test.ts. Плюс три чаще всего падавших файла
    // активно дёргают реестр модулей: vi.resetModules + динамический import,
    // 8 раз в tier3OgRoutes, 10 в provisioning.sendEmail. При пуле ПОТОКОВ
    // несколько файлов живут в одном воркере и делят этот реестр — сброс в
    // одном задевает соседний.
    //
    // Отсюда и наблюдаемая картина: форки (свой процесс на файл) убирают часть
    // падений, последовательный прогон — все.
    //
    // Правильное лечение — модульные синглтоны: перечитывать состояние на
    // каждый вызов (как aev.ts с кошельками) либо дать модулю явный reset()
    // для тестов. Кандидаты: qtrade, src/lib/qpaynetCrypto.ts,
    // src/routes/cyberchessOpening.ts, src/routes/i18n.ts. Это отдельная
    // работа; пока она не сделана, последовательный прогон честнее красного
    // гейта — но причина жива, и при возврате параллелизма всё вернётся.
    //
    // ⚠️ ОСТАТОЧНАЯ НЕСТАБИЛЬНОСТЬ ЕСТЬ, но не от кэша. 29.07 сразу после
    // `npm install` два прогона подряд дали 1 и 2 упавших файла, следующие
    // три — 1008 passed. Я предположил холодный кэш Vite и ПРОВЕРИЛ: три
    // прогона с намеренно удалённым node_modules/.vite — все зелёные
    // (медленнее, 92 с против 20 с, но 0 падений). Значит кэш ни при чём.
    //
    // Наиболее вероятная причина тех двух падений — конкуренция за ресурсы
    // машины: в те минуты параллельно шёл tsc в соседнем worktree. То есть
    // тесты чувствительны к общей нагрузке, а не к состоянию кэша.
    //
    // Практический вывод для CI: следить, не идут ли на том же раннере
    // тяжёлые задачи одновременно. Если падения повторятся на чистой машине,
    // копать надо в разделяемый ресурс между файлами, а не в кэш.
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
