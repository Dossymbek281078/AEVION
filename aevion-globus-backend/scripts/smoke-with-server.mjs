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
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const PORT = process.env.PORT || "4171";
const BASE = `http://127.0.0.1:${PORT}`;
// Можно передать НЕСКОЛЬКО смоуков — они пройдут против одного поднятого
// сервера. Иначе каждый требует своего подъёма, а он на загруженной машине
// занимает минуты: девять смоуков превращались в час ожидания.
const scripts = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (scripts.length === 0) scripts.push("qskyway-smoke");
const script = scripts[0];
const fileOf = (n) => (n.endsWith(".js") || n.endsWith(".mjs") ? n : `${n}.js`);
const scriptFile = fileOf(script);

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

// Сколько ждать подъёма. Настраивается, потому что 120 с — предположение о
// незагруженной машине. 19.08.2026 прогон all-smokes НЕ СОСТОЯЛСЯ именно
// поэтому: в системе было 121 процессов node от соседних сессий и двух
// сборок, и ts-node-dev не успел скомпилировать проект. Отказ выглядел как
// поломка бэкенда, хотя бэкенд был исправен.
const START_TIMEOUT_MS = Number(process.env.SMOKE_START_TIMEOUT_MS || 120_000);

async function waitForHealth(timeoutMs = START_TIMEOUT_MS) {
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

// Пересобрать, если dist отстал от исходников.
//
// Смоуки с пометкой offline бьют НЕ по серверу, а по скомпилированному коду:
// require("../dist/routes/events.js"). 19.08.2026 выяснилось, что dist собран
// 27 июля — то есть три недели эти проверки отвечали про код, которого никто
// не запускает. Опасность двусторонняя: смоук краснеет на ПОЧИНЕННОМ коде
// (так и было — два падения из четырёх) и зеленеет на сломанном, если поломку
// внесли после последней сборки.
//
// Первая версия собирала САМА, по умолчанию. Пришлось передумать: в этом
// репозитории шесть файлов dist ЛЕЖАТ ПОД КОНТРОЛЕМ ВЕРСИЙ (последний коммит
// 21.07), и сборка их меняет. Обёртка проверок, молча правящая отслеживаемые
// файлы, — это подмена: у человека внезапно грязное дерево, а переключение
// веток отбивается. Поймал на себе: из-за этого не прошёл перенос коммитов.
//
// Поэтому предупреждаем, и предупреждение делаем таким, чтобы его нельзя было
// принять за шум: оно называет РАЗРЫВ и последствие. Собрать — SMOKE_BUILD=1.
function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  try { walk(dir); } catch { return 0; }
  return newest;
}

if (true) {
  const srcAt = newestMtime(join(ROOT, "src"));
  const distAt = newestMtime(join(ROOT, "dist"));
  if (srcAt > distAt) {
    const gapMs = srcAt - distAt;
    // «~0 дн.» ничего не сообщает: разрыв бывает и в минуты, и в недели.
    const gap =
      gapMs >= 86_400_000 ? `${Math.round(gapMs / 86_400_000)} дн.`
      : gapMs >= 3_600_000 ? `${Math.round(gapMs / 3_600_000)} ч`
      : `${Math.max(1, Math.round(gapMs / 60_000))} мин`;
    if (process.env.SMOKE_BUILD === "1") {
      console.log(`[smoke] dist отстал от src на ~${gap} — пересобираю`);
      const r = spawnSync("npm run build", { shell: true, cwd: ROOT, stdio: "inherit" });
      if (r.status !== 0) {
        console.error("[smoke] сборка не удалась — offline-смоуки будут врать про старый код");
        process.exit(2);
      }
    } else {
      console.log(
        `[smoke] ⚠ dist отстал от src на ~${gap}. Смоуки с пометкой offline ` +
          "проверяют СКОМПИЛИРОВАННЫЙ код, то есть сейчас — старую сборку: " +
          "они могут покраснеть на починенном и позеленеть на сломанном. " +
          "Собрать перед прогоном: SMOKE_BUILD=1",
      );
    }
  }
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
  console.error(`[smoke] бэкенд не поднялся за ${Math.round(START_TIMEOUT_MS / 1000)} с — прогон не состоялся`);
  stopServer();
  process.exit(2);
}
console.log(`[smoke] поднялся за ~${secs} с, запускаю: ${scripts.join(", ")}`);

// Node зовём напрямую: это .exe, оболочка ему не нужна, и предупреждения нет.
const outcomes = [];
for (const name of scripts) {
  if (scripts.length > 1) console.log(`\n========== ${name} ==========`);
  const r = spawnSync(process.execPath, [join(HERE, fileOf(name))], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, BASE },
  });
  outcomes.push({ name, code: r.status ?? 1 });
}
stopServer();

if (scripts.length > 1) {
  console.log("\n========== Итог ==========");
  for (const o of outcomes) {
    console.log(`  ${o.code === 0 ? "PASS" : "FAIL"}  ${o.name}${o.code === 0 ? "" : ` (код ${o.code})`}`);
  }
  const failed = outcomes.filter((o) => o.code !== 0).length;
  console.log(`\n  всего: ${outcomes.length}, прошло: ${outcomes.length - failed}, упало: ${failed}`);
}

// Код прогона отдаём наружу как есть: ноль — прошло, иначе упало.
// Отдельный код 2 выше означает «прогон НЕ состоялся» — это не то же
// самое, что «смоук упал», и различать их надо.
process.exit(outcomes.some((o) => o.code !== 0) ? 1 : 0);
