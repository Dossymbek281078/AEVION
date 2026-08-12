#!/usr/bin/env node
/**
 * Проверка кнопок «купить»: живы ли адреса магазинов, зашитые во фронтенде.
 *
 * Зачем. Ссылки на Gumroad и Lemon Squeezy записаны в коде страниц напрямую —
 * их 22 штуки на 14 уникальных адресов. Товар в магазине можно переименовать,
 * снять с продажи или пересоздать, и код об этом не узнает: сборка зелёная,
 * страница открывается, а покупатель уезжает на 404. Деньги теряются молча —
 * это самый дорогой класс дефектов, потому что жалоб не будет.
 *
 * Замер 12.08.2026: все 9 адресов Lemon Squeezy отвечали 404 при живом
 * магазине, все 5 адресов Gumroad — 200.
 *
 * Запуск:  node scripts/checkout-links-check.mjs
 * Код выхода: 0 — все живы, 1 — есть мёртвые.
 *
 * В CI намеренно НЕ включено: это обращения к чужим сайтам, им место в ручной
 * или редкой проверке, а не в каждом прогоне на каждый PR.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "frontend/src");
const URL_RE = /https:\/\/[a-z0-9-]+\.(?:gumroad\.com\/l\/[a-zA-Z0-9]+|lemonsqueezy\.com\/checkout\/buy\/[a-f0-9-]+)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

// url -> файлы, где он встречается: без этого в отчёте нечего чинить.
const found = new Map();
for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    if (!found.has(url)) found.set(url, new Set());
    found.get(url).add(file.slice(ROOT.length + 1).replace(/\\/g, "/"));
  }
}

if (found.size === 0) {
  console.log("Ссылок на магазины во фронтенде не нашлось — проверять нечего.");
  process.exit(0);
}

console.log(`Проверяю ${found.size} уникальных адресов…\n`);

const dead = [];
for (const [url, files] of [...found].sort()) {
  let code = 0;
  try {
    // Магазины отдают обычную страницу; GET с браузерным UA — то же, что
    // увидит покупатель. HEAD некоторые витрины обрабатывают иначе.
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (AEVION checkout-links-check)" },
      signal: AbortSignal.timeout(20_000),
    });
    code = res.status;
  } catch (e) {
    console.log(`  СЕТЬ  ${url}\n        ${e.message}`);
    continue; // сетевой сбой — это не «товара нет», в мёртвые не пишем
  }

  const ok = code >= 200 && code < 300;
  console.log(`  ${ok ? "OK " : "МЁРТВ"} ${code}  ${url}`);
  if (!ok) {
    dead.push({ url, code, files: [...files] });
    for (const f of files) console.log(`         ← ${f}`);
  }
  await new Promise((r) => setTimeout(r, 1000)); // не долбим витрину
}

console.log("");
if (dead.length === 0) {
  console.log(`Все ${found.size} кнопок покупки ведут на живые страницы.`);
  process.exit(0);
}

console.log(`МЁРТВЫХ КНОПОК ПОКУПКИ: ${dead.length} из ${found.size}`);
console.log("Покупатель, нажавший такую кнопку, попадает на 404 — продажа теряется без следа.");
process.exit(1);
