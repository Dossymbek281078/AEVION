#!/usr/bin/env node
/**
 * Загрузка разборов в БД прода через админ-ручку POST /api/cyberchess-puzzles/razbory/import (пачки ≤ 2000, upsert).
 * Админ-токен — из stdin (JSON переменных Railway: `railway variables --json | node import.cjs <gotovo.jsonl>`),
 * значение не печатается. Печатает только числа: отправлено / записано / всего в таблице.
 */
const fs = require("fs");
const FILE = process.argv[2]; const API = process.argv[3] || "https://api.aevion.app"; const PACK = 1000;
if (!FILE || !fs.existsSync(FILE)) { console.error("нужен путь к gotovo.jsonl"); process.exit(2); }
let raw = ""; process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => raw += d).on("end", async () => {
  const v = JSON.parse(raw.slice(raw.indexOf("{"))); const adm = v.ADMIN_TOKEN; if (!adm) { console.error("нет ADMIN_TOKEN"); process.exit(2); }
  const rows = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let sent = 0, written = 0, total = 0;
  for (let i = 0; i < rows.length; i += PACK) {
    const items = rows.slice(i, i + PACK).map((r) => ({ id: r.id, ru: r.ru, en: r.en, kk: r.kk, model: r.model }));
    const res = await fetch(`${API}/api/cyberchess-puzzles/razbory/import`, { method: "POST", headers: { "content-type": "application/json", "X-Admin-Token": adm }, body: JSON.stringify({ items }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) { console.error(`пачка ${i / PACK + 1}: ${res.status} ${JSON.stringify(j).slice(0, 160)}`); process.exitCode = 1; continue; }
    sent += items.length; written += j.written; total = j.total;
    console.log(`пачка ${i / PACK + 1}: отправлено ${items.length}, записано ${j.written}, всего в таблице ${j.total}`);
  }
  console.log(`ИТОГ: отправлено ${sent}, записано ${written}, в таблице ${total}`);
});
