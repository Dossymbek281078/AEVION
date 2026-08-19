#!/usr/bin/env node
/**
 * Поднять фронтенд и бэкенд локально одной командой, с ПРАВИЛЬНОЙ связкой.
 *
 * Зачем скрипт, а не строчка в документе. 19.08.2026 я потратил три
 * перезапуска, подбирая переменные окружения, чтобы просто посмотреть свою
 * страницу глазами. Каждая попытка выглядела рабочей и не работала:
 *
 *  1. без `NEXT_PUBLIC_API_BASE_URL` клиент шёл в зашитый по умолчанию порт —
 *     запросы не доходили никуда, страница вечно висела в «загружаю»;
 *  2. с абсолютным адресом бэкенда запрос становился межсайтовым и умирал на
 *     политике браузера;
 *  3. с относительным `/api-backend` заработал клиент, но упала серверная
 *     отрисовка: ей нужен АБСОЛЮТНЫЙ адрес, она берёт его из
 *     `BACKEND_PROXY_TARGET`.
 *
 * Правильно — обе переменные сразу: относительная для браузера, абсолютная
 * для сервера. Документ с этим знанием устаревает первым; исполняемый файл
 * не устаревает, потому что им пользуются.
 *
 * Запуск:
 *   node scripts/dev-local.mjs            # фронт 3101, бэкенд 4101
 *   PORT=3000 API_PORT=4001 node scripts/dev-local.mjs
 *   node scripts/dev-local.mjs --front-only   # если бэкенд уже поднят
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONT = join(HERE, "..");
const BACK = join(FRONT, "..", "aevion-globus-backend");

const FRONT_PORT = process.env.PORT || "3101";
const API_PORT = process.env.API_PORT || "4101";
const API_URL = `http://127.0.0.1:${API_PORT}`;
const frontOnly = process.argv.includes("--front-only");

const children = [];

function run(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
  children.push(p);
  return p;
}

function stopAll() {
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* уже мёртв */
    }
  }
}
process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("exit", stopAll);

if (!frontOnly) {
  console.log(`[dev-local] бэкенд на ${API_URL}`);
  run("npx", ["ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"], {
    cwd: BACK,
    env: { ...process.env, PORT: API_PORT },
  });
}

console.log(`[dev-local] фронтенд на http://127.0.0.1:${FRONT_PORT}`);
console.log(`[dev-local] страница QSkyway: http://127.0.0.1:${FRONT_PORT}/qskyway`);
run("npx", ["next", "dev", "-p", FRONT_PORT], {
  cwd: FRONT,
  env: {
    ...process.env,
    // Браузеру — относительный путь: тогда запрос идёт на тот же адрес и
    // проксируется правилом из next.config (`/api-backend/:path*`).
    NEXT_PUBLIC_API_BASE_URL: "/api-backend",
    // Серверной отрисовке — абсолютный: относительный путь fetch на сервере
    // использовать не может, и страница отдаёт 500 ещё до браузера.
    BACKEND_PROXY_TARGET: API_URL,
  },
});
