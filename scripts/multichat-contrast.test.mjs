#!/usr/bin/env node
// Контраст светлой темы мультичата.
//   node scripts/multichat-contrast.test.mjs
//
// Зачем тест, а не разовая проверка: вся читаемость модуля держится на
// значениях в одном theme.ts. Любая последующая правка цвета — своя или чужая —
// способна уронить контраст, и это НЕ упадёт: ни типы, ни сборка, ни глаз на
// беглом просмотре плохой контраст не ловят. Увидит первым пользователь.
//
// Порог 4.5:1 — уровень AA по WCAG 2.1 для обычного текста.
//
// Отдельно считаются ЧИПЫ ролей. У них фон полупрозрачный, поэтому мерить
// контраст текста к бумаге бессмысленно — надо смешать подложку со слоем под
// ней и считать к результату. Именно там 2026-07-27 и нашёлся худший дефект:
// Finance давал 1.56 (жёлтый текст на бледно-жёлтом), тогда как та же проверка
// «по бумаге» его пропускала.

import { readFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const MOD = path.join(HERE, "..", "frontend/src/app/multichat-engine");
const THRESHOLD = 4.5;

const theme = readFileSync(path.join(MOD, "theme.ts"), "utf8");
const T = Object.fromEntries([...theme.matchAll(/ {2}(\w+): "([^"]+)",/g)].map((m) => [m[1], m[2]]));

const sources = ["MultichatEngineClient.tsx", "CouncilConsole.tsx", "verify/page.tsx", "library/page.tsx"]
  .map((f) => readFileSync(path.join(MOD, f), "utf8"));
const code = sources.join("\n");

/* ── Цвет ───────────────────────────────────────────────────────────────── */

function parse(v) {
  if (v.startsWith("#")) {
    let h = v.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  const n = v.slice(v.indexOf("(") + 1, -1).split(",").map((x) => parseFloat(x.trim()));
  return [Math.round(n[0]), Math.round(n[1]), Math.round(n[2]), n.length > 3 ? n[3] : 1];
}

/** Наложить полупрозрачный цвет на непрозрачный. */
const over = ([r1, g1, b1, a], [r2, g2, b2]) => [
  Math.round(r1 * a + r2 * (1 - a)),
  Math.round(g1 * a + g2 * (1 - a)),
  Math.round(b1 * a + b2 * (1 - a)),
  1,
];

function luminance([r, g, b]) {
  const f = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ── Проверки ───────────────────────────────────────────────────────────── */

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

const SURFACES = ["canvas", "surface"];
for (const s of SURFACES) {
  ok(`подложка ${s} задана и непрозрачна`, !!T[s] && parse(T[s])[3] === 1, T[s]);
}

// Текст на акцентной кнопке нельзя мерить к бумаге: белый на белом даст 1.00
// и уронит проверку на цвете, который на экране лежит на бирюзе. Роль зашита
// в имя (onAccent*), поэтому подложка для него — акцентные заливки, а не лист.
// Ровно та же логика, что у чипов ниже: сравнивать надо с тем, на чём цвет
// реально лежит.
// Условие «светлый» обязательно: onAccent (#1a1a17) — тёмные чернила, они
// лежат и на белых поверхностях тоже, мерить их к бирюзе неверно. А светлый
// токен на бумаге не живёт по определению: он существует ради тёмной кнопки.
const ACCENT_BACKDROPS = ["btnAccentBg", "accent"];
const isOnAccent = (n) => /^onAccent/.test(n) && luminance(parse(T[n])) > 0.5;

// 1. Обычный текст — к бумаге и к панели.
const textTokens = Object.keys(T).filter(
  (n) => new RegExp(`color: T\\.${n}\\b`).test(code) && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(T[n])
);
ok("текстовые токены найдены", textTokens.length >= 10, `найдено ${textTokens.length}`);

for (const n of textTokens) {
  const backdrops = isOnAccent(n) ? ACCENT_BACKDROPS : SURFACES;
  const worst = Math.min(...backdrops.map((s) => contrast(parse(T[n]), parse(T[s]))));
  const where = isOnAccent(n) ? "на акцентной кнопке" : "на подложке";
  ok(`текст ${n} читается ${where}`, worst >= THRESHOLD, `${worst.toFixed(2)} < ${THRESHOLD} (${T[n]})`);
}

// 2. Чипы ролей — текст к СМЕШАННОЙ подложке, а не к бумаге.
const block = code.match(/ROLE_COLORS[^=]*= \{([\s\S]*?)\n\};/);
ok("палитра чипов найдена", !!block);

if (block) {
  const chips = [...block[1].matchAll(/"?([\w/]+)"?:\s*\{ bg: T\.(\w+),\s*border: T\.(\w+),\s*fg: T\.(\w+)/g)];
  ok("чипы разобраны", chips.length >= 5, `разобрано ${chips.length}`);

  for (const [, name, bg, , fg] of chips) {
    const worst = Math.min(...SURFACES.map((s) => contrast(parse(T[fg]), over(parse(T[bg]), parse(T[s])))));
    ok(`чип ${name} читается на своей подложке`, worst >= THRESHOLD,
      `${worst.toFixed(2)} < ${THRESHOLD} (текст ${T[fg]} на ${T[bg]})`);
  }
}

// 3. Сырых цветов в компонентах быть не должно — иначе проверка их не видит,
//    и цвет живёт вне всякого контроля.
for (const [i, src] of sources.entries()) {
  const raw = src.match(/rgba\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) || [];
  ok(`в файле ${i + 1} нет цветов мимо токенов`, raw.length === 0, `найдено ${raw.length}: ${raw.slice(0, 3)}`);
}

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
