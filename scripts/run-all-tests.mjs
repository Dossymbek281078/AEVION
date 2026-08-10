#!/usr/bin/env node
// Общий прогон тестов монорепо: оба пакета, каждый — своим конфигом.
//
// Почему отдельный скрипт, а не `npm run test:backend && npm run test:frontend`:
// у `&&` второй пакет не запускается, если первый упал. У бэкенда есть две
// давно известные хронические нестабильности
// (`04-Daily/test-suite-flakiness-2026-07-26.md`), то есть при `&&` фронтовые
// тесты не выполнялись бы почти никогда — ровно та дыра, ради закрытия которой
// этот скрипт и написан. Здесь оба пакета проходят всегда, а код возврата
// ненулевой, если упал хоть один.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Пакет → как в нём объявлен прогон юнит-тестов. */
const PACKAGES = [
  { dir: "aevion-globus-backend", script: "test" },
  { dir: "frontend", script: "test:run" },
];

const only = process.argv[2]; // необязательный фильтр: имя каталога пакета
const targets = only ? PACKAGES.filter((p) => p.dir === only) : PACKAGES;

if (targets.length === 0) {
  console.error(`Неизвестный пакет "${only}". Доступны: ${PACKAGES.map((p) => p.dir).join(", ")}`);
  process.exit(2);
}

const results = [];
for (const { dir, script } of targets) {
  console.log(`\n=== ${dir}: npm run ${script} ===\n`);
  const r = spawnSync("npm", ["run", script, "--prefix", dir], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32", // npm на Windows — .cmd, без shell не запустится
  });
  results.push({ dir, code: r.status ?? 1 });
}

console.log("\n=== Итог ===");
for (const { dir, code } of results) {
  console.log(`${code === 0 ? "OK   " : "ПАДЕТ"} ${dir}`);
}

const failed = results.filter((r) => r.code !== 0);
if (failed.length > 0) {
  console.log(
    `\nУпало пакетов: ${failed.length} из ${results.length}. ` +
      "Прогон обоих выполнен полностью — падение одного не отменяет второй.",
  );
}
process.exit(failed.length > 0 ? 1 : 0);
