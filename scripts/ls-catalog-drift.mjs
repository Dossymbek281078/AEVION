#!/usr/bin/env node
/**
 * Сверка витрины Lemon Squeezy с тем, что код умеет выдать.
 *
 * ЗАЧЕМ. У Gumroad такая сверка появилась 13.08.2026, у Lemon Squeezy её не было
 * — и построить её было не на чем: соответствие «товар → модуль» держится на
 * переменных Railway, снаружи невидимых. Теперь `/api/health` отдаёт признак по
 * каждой ссылке, а в коде есть таблица «название товара → ссылка». Двух этих
 * кусков хватает, чтобы спросить главное: **что случится, если этот товар
 * купят?**
 *
 * Три ответа, и все три полезны:
 *   выдадим       — название известно и переменная задана;
 *   ОТКАЖЕМ       — название известно, переменной нет: покупка вернёт 500;
 *   не знаем      — товара нет в таблице: выдавать нечем.
 *
 * Запуск:  node scripts/ls-catalog-drift.mjs
 *          PROD_BASE=https://aevion.app node scripts/ls-catalog-drift.mjs
 * Код выхода: 0 — расхождений нет либо проверить не удалось, 2 — есть расхождение.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STORE = process.env.LS_STORE_URL || "https://aevion.lemonsqueezy.com/";
const PROD_BASE = process.env.PROD_BASE || "https://aevion.app";
const VARIANTS_FILE = resolve(process.cwd(), "aevion-globus-backend/src/data/lemonSqueezyVariants.ts");

const UA = "AEVION-ls-catalog-drift/1.0 (+https://aevion.app)";

/** Таблица «название → ссылка» читается из кода: второй копии быть не должно. */
function nameMapFromSource(src) {
  const block = src.match(/STOREFRONT_NAME_TO_REFERENCE[^=]*=\s*\{([\s\S]*?)\n\};/);
  const map = {};
  if (block) {
    for (const m of block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) map[m[1]] = m[2];
  }
  return map;
}

/**
 * Цены, которые ОБЕЩАЕТ сайт. Два независимых источника, оба в коде:
 *   - тарифы платформы — TIERS в pricing.ts (priceMonthly / priceAnnualTotal);
 *   - модули — записи с processor "lemonsqueezy" в frontend/src/lib/products.ts.
 *
 * Возвращаем Map «ссылка → {usd, откуда}». Чего сопоставить не смогли — просто
 * нет в Map, и про такой товар скрипт скажет «сверить не с чем», а не промолчит.
 */
function sitePrices() {
  const out = new Map();

  try {
    const src = readFileSync(resolve(process.cwd(), "aevion-globus-backend/src/data/pricing.ts"), "utf8");
    for (const m of src.matchAll(/id:\s*"(lite|medium|full|pro)"[\s\S]{0,600}?priceMonthly:\s*([\d.]+)[\s\S]{0,300}?priceAnnualTotal:\s*[^\n]*?\(?\s*([\d.]+)\s*\)?/g)) {
      const [, id, monthly] = m;
      out.set(`tier_${id}_monthly`, { usd: Number(monthly), from: "pricing.ts" });
      // Годовая = ×10 (два месяца в подарок) — правило объявлено там же.
      out.set(`tier_${id}_annual`, { usd: Number(monthly) * 10, from: "pricing.ts ×10" });
    }
  } catch { /* ниже скажем честно */ }

  try {
    const src = readFileSync(resolve(process.cwd(), "frontend/src/lib/products.ts"), "utf8");
    for (const m of src.matchAll(/\{[^{}]*processor:\s*"lemonsqueezy"[^{}]*\}/gs)) {
      const body = m[0];
      const title = /title:\s*"([^"]+)"/.exec(body)?.[1];
      const price = /priceUsd:\s*([\d.]+)/.exec(body)?.[1];
      const appId = /appId:\s*"([^"]+)"/.exec(body)?.[1];
      if (!price) continue;
      const entry = { usd: Number(price), from: "products.ts" };
      if (title) out.set(`title:${normalizeTitle(title)}`, entry);
      // Связь по appId надёжнее названия: в магазине товар зовётся «AEVION
      // CyberChess Pro», а на сайте «CyberChess» — по имени они не сходятся,
      // хотя это один товар. Мост «ссылка → модуль» уже есть в коде
      // (APP_SLUG_TO_MODULE_ID), новую таблицу не заводим.
      if (appId) out.set(`app:${appId}`, entry);
    }
  } catch { /* ниже скажем честно */ }

  return out;
}

/** app_<slug> → id модуля, как это делает бэкенд. Читаем его таблицу, не свою. */
function moduleIdBySlug(variantsSrc) {
  const block = variantsSrc.match(/APP_SLUG_TO_MODULE_ID[^=]*=\s*\{([\s\S]*?)\n\};/);
  const map = {};
  if (block) {
    for (const m of block[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) map[m[1]] = m[2];
  }
  return map;
}

/** «AEVION DevHub Studio Pro» и «DevHub Studio Pro» — один товар. */
function normalizeTitle(s) {
  return s.replace(/^AEVION\s+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Названия товаров с витрины. Берём из текста страницы, рядом с ценой. */
function storefrontNames(html) {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const out = new Set();
  for (const m of plain.matchAll(/(AEVION [A-Za-z0-9 —\-]{2,60}?)\s\$[\d.,]+\/(?:month|year)/g)) {
    // К первому товару прилипают имя магазина и текст кнопки: витрина выглядит
    // как «AEVION Mind Subscribe AEVION Constitution Lab $29/month». Ловим это
    // разбором, а не исключением в таблице: исключение спрятало бы ошибку
    // чтения и завтра пропустило бы настоящий незнакомый товар.
    let name = m[1].trim();
    const afterButton = name.lastIndexOf("Subscribe ");
    if (afterButton >= 0) name = name.slice(afterButton + "Subscribe ".length).trim();
    out.add(name);
  }
  return [...out];
}

/** Название → цена на витрине магазина, в долларах. */
function storefrontPrices(html) {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const out = new Map();
  for (const m of plain.matchAll(/(AEVION [A-Za-z0-9 —\-]{2,60}?)\s\$([\d.,]+)\/(month|year)/g)) {
    let name = m[1].trim();
    const afterButton = name.lastIndexOf("Subscribe ");
    if (afterButton >= 0) name = name.slice(afterButton + "Subscribe ".length).trim();
    out.set(name, { usd: Number(m[2].replace(/,/g, "")), period: m[3] });
  }
  return out;
}

async function main() {
  let map;
  try {
    map = nameMapFromSource(readFileSync(VARIANTS_FILE, "utf8"));
  } catch (e) {
    console.log(`Не прочитать таблицу вариантов: ${e.message}. Судить не по чему.`);
    return;
  }
  if (Object.keys(map).length === 0) {
    console.log("⚠️  Таблицу «название → ссылка» разобрать не удалось. Проверьте разбор, а не магазин.");
    return;
  }

  let names;
  let html = "";
  try {
    const res = await fetch(STORE, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
    if (!(res.status >= 200 && res.status < 300)) {
      console.log(`Витрина ответила ${res.status} — это НЕ «товаров нет», просто не проверено.`);
      return;
    }
    html = await res.text();
    names = storefrontNames(html);
  } catch (e) {
    console.log(`Витрина не открылась: ${e.message}. Это НЕ «товаров нет», просто не проверено.`);
    return;
  }
  if (names.length === 0) {
    console.log("⚠️  На витрине не нашлось названий — вероятно сменилась разметка. Не сужу.");
    return;
  }

  // Какие ссылки настроены на проде. Без этого можно сказать только «известен
  // товар или нет», но не «выдадим ли».
  let configured = null;
  try {
    const res = await fetch(`${PROD_BASE}/api-backend/api/health`, {
      headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000),
    });
    if (res.status >= 200 && res.status < 300) {
      const j = await res.json();
      configured = j && typeof j.lsVariants === "object" ? j.lsVariants : null;
    }
  } catch { /* ниже скажем честно */ }

  if (!configured) {
    console.log("ℹ️  Прод не отдал lsVariants (старая версия или недоступен) — про настройку");
    console.log("   переменных сказать нечего. Проверяю только известность товаров.\n");
  }

  console.log(`На витрине товаров: ${names.length}. В таблице кода: ${Object.keys(map).length}.\n`);

  const unknown = [];
  const notConfigured = [];
  for (const name of names.sort()) {
    const ref = map[name];
    let state;
    if (!ref) { state = "НЕ ЗНАЕМ — выдавать нечем"; unknown.push(name); }
    else if (configured === null) state = `→ ${ref} (настройка неизвестна)`;
    else if (configured[ref]) state = `→ ${ref} · выдадим`;
    else { state = `→ ${ref} · ОТКАЖЕМ: переменная не задана`; notConfigured.push(name); }
    console.log(`  ${name.padEnd(30)} ${state}`);
  }

  // ── Цены ──────────────────────────────────────────────────────────────────
  //
  // Состав сходится, а цена может расходиться молча: покупатель видит на
  // странице $39, платит в магазине $149 и открывает спор. Сверяем то, что
  // обещает сайт, с тем, что берёт магазин, и отдельно называем товары, по
  // которым сверить не с чем — «не проверено» это не «совпало».
  const site = sitePrices();
  const shop = storefrontPrices(html);
  const slugToModule = moduleIdBySlug(readFileSync(VARIANTS_FILE, "utf8"));
  const priceMismatch = [];
  const priceUnknown = [];

  if (site.size === 0 || shop.size === 0) {
    console.log("\n⚠️  Цены сверить не удалось: не прочитались источники (сайт или витрина).");
    console.log("    Это НЕ «цены совпадают».");
  } else {
    console.log("\nЦЕНЫ (сайт обещает → магазин берёт):");
    for (const name of [...shop.keys()].sort()) {
      const ref = map[name];
      const shopPrice = shop.get(name);
      const slug = ref && ref.startsWith("app_") ? ref.slice("app_".length) : null;
      const moduleId = slug ? slugToModule[slug] || slug : null;
      const expected =
        (ref && site.get(ref)) ||
        (moduleId && site.get(`app:${moduleId}`)) ||
        site.get(`title:${normalizeTitle(name)}`);

      if (!expected) {
        priceUnknown.push(name);
        console.log(`  ${name.padEnd(30)} магазин $${shopPrice.usd}/${shopPrice.period} · сверить не с чем`);
        continue;
      }
      const ok = Math.abs(expected.usd - shopPrice.usd) < 0.01;
      if (!ok) priceMismatch.push(`${name}: сайт $${expected.usd}, магазин $${shopPrice.usd}`);
      console.log(
        `  ${name.padEnd(30)} сайт $${expected.usd} (${expected.from}) → магазин $${shopPrice.usd}` +
          (ok ? " · совпадает" : "  ← РАСХОЖДЕНИЕ"),
      );
    }
  }

  const missingOnStore = Object.keys(map).filter((n) => !names.includes(n));
  if (missingOnStore.length) {
    console.log("\nЕСТЬ В ТАБЛИЦЕ, НО НЕТ НА ВИТРИНЕ (товар сняли, код не знает):");
    for (const n of missingOnStore) console.log(`  ${n}`);
  }

  console.log("");
  if (!unknown.length && !notConfigured.length && !missingOnStore.length && !priceMismatch.length) {
    const tail = priceUnknown.length ? ` По ${priceUnknown.length} товар(ам) цену сверить не с чем.` : "";
    console.log(`Расхождений нет: витрина и код совпадают.${tail}`);
    return;
  }
  if (unknown.length) console.log(`РАСХОЖДЕНИЕ: ${unknown.length} товар(ов) на витрине не сопоставлены — ${unknown.join(", ")}.`);
  if (notConfigured.length) console.log(`РАСХОЖДЕНИЕ: ${notConfigured.length} товар(ов) продаются, но переменная не задана — покупка вернёт 500.`);
  if (missingOnStore.length) console.log(`РАСХОЖДЕНИЕ: ${missingOnStore.length} строк(и) таблицы без товара на витрине.`);
  if (priceMismatch.length) {
    console.log(`РАСХОЖДЕНИЕ В ЦЕНЕ: ${priceMismatch.length} товар(ов) — покупатель видит одно, платит другое:`);
    for (const p of priceMismatch) console.log(`  ${p}`);
  }
  process.exitCode = 2;
}

await main();
