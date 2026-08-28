#!/usr/bin/env node
/**
 * Завести ОТДЕЛЬНУЮ локальную базу под прогон смоуков и напечатать её URL.
 *
 * Зачем отдельная. 19.08.2026 полный набор в режиме записи прогнан впервые и
 * дал 22 падения из 69 — почти все оттого, что локальной базы не было вовсе
 * (`DATABASE_URL` не задан). То есть прогон измерял отсутствие базы, а не
 * качество кода.
 *
 * Почему не взять чужую. На машине уже есть `aevion_dev` и `aevion`, но их
 * держат соседние сессии, а смоуки ПИШУТ: бронируют слоты, создают заявки,
 * начисляют. Прогон в чужой базе испортил бы чужие данные, и заметили бы это
 * не сразу.
 *
 * Учётные данные берём из уже настроенного .env соседнего worktree и НЕ
 * печатаем: в вывод идёт URL с замазанным паролем.
 *
 * Запуск:
 *   node scripts/smoke-db-setup.mjs              # создать и показать URL
 *   node scripts/smoke-db-setup.mjs --print-url  # только URL, для подстановки
 *
 * Коды выхода: 0 — база готова, 1 — не удалось, 2 — неоткуда взять доступ.
 */

import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

const TARGET = process.env.SMOKE_DB_NAME || "aevion_smoke";
const printOnly = process.argv.includes("--print-url");

// Порядок источников: сначала свой .env, потом соседние worktree.
const CANDIDATES = [
  "aevion-globus-backend/.env",
  "C:/Users/user/aevion-core/aevion-globus-backend/.env",
  "C:/Users/user/aevion-build/aevion-globus-backend/.env",
];

function findBaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const p of CANDIDATES) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^DATABASE_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const mask = (u) => u.replace(/:\/\/[^@]*@/, "://<скрыто>@");

const raw = findBaseUrl();
if (!raw) {
  console.error("[smoke-db] неоткуда взять доступ к Postgres: нет DATABASE_URL и нет .env");
  process.exit(2);
}

const base = raw.split("?")[0];
const adminUrl = base.replace(/\/[^/]+$/, "/postgres");
const targetUrl = base.replace(/\/[^/]+$/, "/" + TARGET);

const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 8000 });
try {
  await client.connect();
  const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [TARGET]);
  if (r.rowCount === 0) {
    // Имя базы нельзя передать параметром — подставляем, но только из своего
    // же списка допустимых символов, чтобы SMOKE_DB_NAME не стал инъекцией.
    if (!/^[a-z0-9_]+$/.test(TARGET)) {
      console.error("[smoke-db] недопустимое имя базы: " + TARGET);
      process.exit(1);
    }
    await client.query(`CREATE DATABASE "${TARGET}"`);
    if (!printOnly) console.error("[smoke-db] создана база " + TARGET);
  } else if (!printOnly) {
    console.error("[smoke-db] база " + TARGET + " уже есть");
  }
} catch (e) {
  console.error("[smoke-db] не удалось: " + e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

if (printOnly) process.stdout.write(targetUrl);
else console.error("[smoke-db] URL: " + mask(targetUrl));
