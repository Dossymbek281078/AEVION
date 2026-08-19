#!/usr/bin/env node
/**
 * Сверка живого каталога Gumroad с картой товаров в коде.
 *
 * ЗАЧЕМ. С 13.08.2026 вебхук честно отвечает 500 на незнакомый товар — лучше
 * видимая ошибка, чем подарок наугад. Но узнаём мы о ней только когда КТО-ТО
 * УЖЕ КУПИЛ: человек заплатил, доставка провалилась, и разбираться приходится
 * с живым покупателем на руках.
 *
 * Этот сторож смотрит вперёд: новый товар в магазине виден до первой покупки.
 * Обратное тоже важно — строка в карте, которой больше нет в магазине, значит
 * товар сняли, а код об этом не знает.
 *
 * ЧЕГО ОН НЕ ВИДИТ. Ветки, работающие через переменные окружения
 * (GUMROAD_PERMALINK_*), заданы на Railway, а не в коде: их отсюда не прочитать.
 * Поэтому товар может быть сопоставлен переменной и всё равно попасть в список
 * «не сопоставлен». Это ложная тревога по построению — она названа в выводе,
 * а не спрятана.
 *
 * Запуск:  node scripts/gumroad-catalog-drift.mjs
 * Код выхода: 0 — расхождений нет либо проверить не удалось, 2 — есть расхождение.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STORE = process.env.GUMROAD_STORE_URL || "https://aevion.gumroad.com/";
const WEBHOOK = resolve(process.cwd(), "aevion-globus-backend/src/routes/gumroadWebhook.ts");

/** Карта из кода: slug → что выдаём. Читаем текстом — скрипт идёт без сборки TS. */
function mapFromSource(src) {
  const block = src.match(/KNOWN_PERMALINK_REFERENCE[^=]*=\s*\{([\s\S]*?)\n\};/);
  const map = {};
  if (block) {
    for (const m of block[1].matchAll(/^\s*([a-z0-9]+)\s*:\s*"([^"]+)"/gm)) map[m[1]] = m[2];
  }
  return map;
}

async function main() {
  let src;
  try {
    src = readFileSync(WEBHOOK, "utf8");
  } catch (e) {
    console.log(`Не прочитать обработчик (${WEBHOOK}): ${e.message}. Судить не по чему.`);
    return;
  }

  const map = mapFromSource(src);
  if (Object.keys(map).length === 0) {
    console.log("⚠️  Карту товаров разобрать не удалось — сравнивать не с чем. Проверьте разбор, а не магазин.");
    return;
  }

  let html;
  try {
    const res = await fetch(STORE, {
      headers: { "User-Agent": "AEVION-catalog-drift/1.0 (+https://aevion.app)" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!(res.status >= 200 && res.status < 300)) {
      console.log(`Магазин ответил ${res.status} — это НЕ «товаров нет», просто не проверено.`);
      return;
    }
    html = await res.text();
  } catch (e) {
    console.log(`Магазин не открылся: ${e.message}. Это НЕ «товаров нет», просто не проверено.`);
    return;
  }

  const live = [...new Set([...html.matchAll(/\/l\/([a-zA-Z0-9]{4,10})/g)].map((m) => m[1]))].sort();
  if (live.length === 0) {
    console.log("⚠️  На витрине не нашлось ни одного товара — скорее всего сменилась разметка. Не сужу.");
    return;
  }

  const mapped = new Set(Object.keys(map));
  const unmapped = live.filter((s) => !mapped.has(s));
  const gone = [...mapped].filter((s) => !live.includes(s)).sort();

  console.log(`В магазине товаров: ${live.length}. В карте кода: ${mapped.size}.\n`);

  console.log("ЖИВЫЕ ТОВАРЫ:");
  for (const slug of live) {
    const what = map[slug];
    console.log(`  ${slug.padEnd(9)} ${what ? `→ ${what}` : "НЕ СОПОСТАВЛЕН — покупка вернёт 500"}`);
  }

  if (gone.length) {
    console.log("\nЕСТЬ В КАРТЕ, НО НЕТ В МАГАЗИНЕ (товар сняли, код не знает):");
    for (const slug of gone) console.log(`  ${slug} → ${map[slug]}`);
  }

  console.log("");
  if (unmapped.length === 0 && gone.length === 0) {
    console.log("Расхождений нет: каталог и карта совпадают.");
    return;
  }

  if (unmapped.length) {
    console.log(`РАСХОЖДЕНИЕ: ${unmapped.length} товар(ов) в продаже без сопоставления — ${unmapped.join(", ")}.`);
    console.log("Покупка любого из них вернёт 500 и НИЧЕГО не выдаст. Добавьте строку в");
    console.log("KNOWN_PERMALINK_REFERENCE (или задайте GUMROAD_PERMALINK_* на Railway —");
    console.log("переменные окружения отсюда не видны, так что этот список может быть шире правды).");
  }
  if (gone.length) {
    console.log(`РАСХОЖДЕНИЕ: ${gone.length} строк(и) карты без товара в магазине.`);
  }
  process.exitCode = 2;
}

await main();
