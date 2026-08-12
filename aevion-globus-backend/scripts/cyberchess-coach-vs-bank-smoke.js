#!/usr/bin/env node
/**
 * CyberChess: тренер учит приёму — есть ли на него задачи в банке?
 *
 * 12.08.2026 «Связка» и «Рентген» отдавали НОЛЬ задач при 25 460 вилках, а урок
 * тренера называл связку половиной всей тактики до 1800 ELO и советовал решать
 * по 20 задач в день. Ничего не падало: интерфейс фильтрует темы у себя, поэтому
 * пустого экрана никто не видел — приём просто стало не на чем тренировать.
 * Причина была в импорте (фаза партии перебивала тактику), но заметить это могла
 * только сверка «чему учим» против «что в банке». Её и делает этот смок.
 *
 * Оба списка берутся из СУЩЕСТВУЮЩИХ источников правды, третьего не заводим:
 *   чему учим  — motif-и в frontend/src/app/cyberchess/chessCoachEngine.ts
 *   тег → тема — THEME_MAP в scripts/seed-puzzles.mjs
 *
 * Usage:
 *   node scripts/cyberchess-coach-vs-bank-smoke.js
 *
 * Env:
 *   BASE      по умолчанию прод https://aevion.app/api-backend
 *   MIN_COUNT минимум задач на тему, чтобы считать её пригодной (по умолчанию 1)
 *
 * Коды выхода: 0 — все приёмы обеспечены задачами; 1 — есть необеспеченные;
 * 2 — не смог проверить (нет файлов или банк недоступен). Третий код отдельно:
 * «не смог проверить» не должно выглядеть как «всё хорошо».
 */

const fs = require("node:fs");
const path = require("node:path");

const BASE = (process.env.BASE || "https://aevion.app/api-backend").replace(/\/+$/, "");
const MIN_COUNT = Math.max(1, Number(process.env.MIN_COUNT) || 1);
const TIMEOUT_MS = 20000;

const ENGINE = path.join(__dirname, "..", "..", "frontend", "src", "app", "cyberchess", "chessCoachEngine.ts");
const SEED = path.join(__dirname, "seed-puzzles.mjs");

/** THEME_MAP из сеялки — читаем её текст, а не копируем таблицу к себе. */
function readThemeMap() {
  const src = fs.readFileSync(SEED, "utf8");
  const i = src.indexOf("const THEME_MAP");
  const j = src.indexOf("function getPhase");
  if (i < 0 || j < 0) return null;
  try {
    return new Function(src.slice(i, j) + "; return THEME_MAP;")();
  } catch {
    return null;
  }
}

/** id-ы приёмов, которым учит тренер. */
function readCoachMotifs() {
  const src = fs.readFileSync(ENGINE, "utf8");
  const ids = [];
  const re = /id:\s*"([A-Za-z][A-Za-z0-9]*)"\s*,\s*name:\s*"/g;
  let m;
  while ((m = re.exec(src)) !== null) ids.push(m[1]);
  return ids;
}

async function themeCount(theme) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${BASE}/api/cyberchess-puzzles/?theme=${encodeURIComponent(theme)}&limit=1`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { error: `http_${res.status}` };
    const d = await res.json();
    return { total: Number(d.total) || 0 };
  } catch (e) {
    return { error: e.name === "AbortError" ? "timeout" : String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  if (!fs.existsSync(ENGINE) || !fs.existsSync(SEED)) {
    console.error("НЕ СМОГ ПРОВЕРИТЬ: нет движка тренера или сеялки рядом");
    process.exit(2);
  }
  const THEME_MAP = readThemeMap();
  if (!THEME_MAP) {
    console.error("НЕ СМОГ ПРОВЕРИТЬ: не разобрал THEME_MAP в seed-puzzles.mjs");
    process.exit(2);
  }

  // Пересечение: у тренера есть и дебютные структуры (iqp, maroczy) — они не
  // темы задач и в THEME_MAP отсутствуют, поэтому отсеиваются сами.
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const taught = [...new Set(readCoachMotifs())].filter((id) => own(THEME_MAP, id));
  if (taught.length === 0) {
    console.error("НЕ СМОГ ПРОВЕРИТЬ: ни один приём тренера не сопоставился с темами банка");
    process.exit(2);
  }

  console.log(`Банк: ${BASE}`);
  console.log(`Приёмов у тренера, сопоставленных с темами банка: ${taught.length}\n`);

  const empty = [];
  const unreachable = [];
  for (const id of taught) {
    const theme = THEME_MAP[id];
    const r = await themeCount(theme);
    if (r.error) {
      // Недоступность банка — НЕ провал приёма. Отдельная корзина, иначе разрыв
      // связи однажды прочтётся как «тренер учит пустоте».
      unreachable.push(`${theme} (${r.error})`);
      console.log(`  ?  ${theme.padEnd(24)} не смог спросить: ${r.error}`);
      continue;
    }
    const bad = r.total < MIN_COUNT;
    if (bad) empty.push({ id, theme, total: r.total });
    console.log(`  ${bad ? "ПУСТО" : "ok   "} ${theme.padEnd(24)} задач: ${r.total}`);
  }

  console.log("");
  if (unreachable.length === taught.length) {
    console.error("НЕ СМОГ ПРОВЕРИТЬ: банк не ответил ни на один запрос");
    process.exit(2);
  }
  if (empty.length === 0) {
    console.log("Все приёмы тренера обеспечены задачами.");
    process.exit(0);
  }

  console.error(`ПРОВАЛ: приёмов без задач — ${empty.length}:`);
  for (const e of empty) console.error(`   ${e.theme} (тег ${e.id}) — ${e.total} задач`);
  console.error("");
  console.error("Тренер учит приёму, которого не на чем отработать. Обычная причина —");
  console.error("раскладка тем при импорте: прогнать scripts/seed-puzzles.mjs заново.");
  process.exit(1);
})();
