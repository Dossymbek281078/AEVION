#!/usr/bin/env node
/**
 * Поднять бэкенд, прогнать смоук, погасить бэкенд — одной командой.
 *
 * Зачем. Все смоуки бьют в уже запущенный сервер (`all-smokes.js` берёт
 * BASE и сам ничего не поднимает). Значит перед прогоном надо помнить
 * поднять бэкенд — и именно поэтому смоуки В РЕЖИМЕ ЗАПИСИ не гонялись
 * ни разу: на проде их запускать нельзя (они бронируют слоты и создают
 * записи), а локально каждый раз нужен лишний шаг.
 *
 * Замер 19.08.2026: прогон QSkyway в режиме записи прошёл ВПЕРВЫЕ и дал
 * 143 из 143, покрыв то, чего на проде не потрогать: предел вместимости
 * рынка слотов, отказ 409 при переполнении, выдачу чека QRight и разницу
 * между «не найден» и «подделан».
 *
 * Запуск:
 *   node scripts/smoke-with-server.mjs                 # смоук QSkyway
 *   node scripts/smoke-with-server.mjs qsign-v2-smoke  # любой другой
 *   node scripts/smoke-with-server.mjs all-smokes      # все подряд
 *   PORT=4180 node scripts/smoke-with-server.mjs
 *
 * Сервер гасится ВСЕГДА — и после успеха, и после падения, и по Ctrl+C.
 * Иначе от прогонов остаются процессы, которые потом держат порт и память
 * (на этой машине такое уже случалось).
 */

import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const PORT = process.env.PORT || "4171";
const BASE = `http://127.0.0.1:${PORT}`;
const script = process.argv[2] || "qskyway-smoke";
const scriptFile = script.endsWith(".js") || script.endsWith(".mjs") ? script : `${script}.js`;

let server = null;
let stopped = false;

function stopServer() {
  if (stopped || !server || !server.pid) return;
  stopped = true;
  // ВАЖНО: убивать надо ДЕРЕВО, а не то, что мы породили.
  //
  // Проверено на себе 19.08.2026: первая версия звала server.kill(), и это
  // убивало обёртку (shell → npx), а сам сервер оставался жить. После
  // прогона порт был занят, а в системе висели ЧЕТЫРЕ процесса ts-node-dev.
  // То есть комментарий обещал «сервер гасится всегда», а на деле не гасился
  // ни разу — ровно тот разрыв между обещанием и поставкой, который мы ищем
  // в чужом коде.
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    /* уже мёртв */
  }
}
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});
process.on("exit", stopServer);

async function waitForHealth(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return Math.round((Date.now() - started) / 1000);
    } catch {
      /* ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

console.log(`[smoke] поднимаю бэкенд на ${BASE}`);
// Команда ОДНОЙ СТРОКОЙ с оболочкой, а не массивом аргументов.
//
// Два неверных варианта, оба проверены 19.08.2026:
//   shell:true + массив аргументов → предупреждение DEP0190 в каждом выводе,
//     оно засоряет лог и отчёт, который читает человек;
//   npx.cmd напрямую без оболочки → «Error: spawn EINVAL», на Windows .cmd
//     без оболочки не запускается вовсе. Эта «починка» сломала запуск, и
//     поймала её проверка, а не внимательность.
const CMD = "npx ts-node-dev --respawn --transpile-only src/index.ts";
server = spawn(CMD, {
  shell: true,
  cwd: ROOT,
  stdio: ["ignore", "ignore", "inherit"],
  detached: process.platform !== "win32",
  env: { ...process.env, PORT },
});

const secs = await waitForHealth();
if (secs === null) {
  console.error("[smoke] бэкенд не поднялся за 120 с — прогон не состоялся");
  stopServer();
  process.exit(2);
}
console.log(`[smoke] поднялся за ~${secs} с, запускаю ${scriptFile}`);

// Node зовём напрямую: это .exe, оболочка ему не нужна, и предупреждения нет.
const smoke = spawn(process.execPath, [join(HERE, scriptFile)], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, BASE },
});

smoke.on("exit", (code) => {
  stopServer();
  // Код прогона отдаём наружу как есть: ноль — прошло, иначе упало.
  // Отдельный код 2 выше означает «прогон НЕ состоялся» — это не то же
  // самое, что «смоук упал», и различать их надо.
  process.exit(code ?? 1);
});
