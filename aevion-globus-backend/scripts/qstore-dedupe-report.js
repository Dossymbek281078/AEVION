#!/usr/bin/env node
/**
 * Дубли товаров в QStore: ОТЧЁТ и, по явной просьбе, уборка.
 *
 * Откуда взялись. Скрипт заполнения проверял «уже есть» запросом
 * `/api/qstore/products?search=<название>&limit=1`. Ручка читает параметр `q`,
 * а не `search`, поэтому фильтра не было; `limit=1` оставлял один произвольный
 * товар. Проверка спрашивала «совпадает ли название первого попавшегося с
 * моим», получала «нет» и создавала копию — по одной за запуск.
 * Замер 21.08.2026 на проде: 20 записей, уникальных названий 6.
 * Причина устранена (коммит a25c3ce1e), но уже созданные копии остались.
 *
 * ПО УМОЛЧАНИЮ НИЧЕГО НЕ УДАЛЯЕТ. Удаление данных необратимо, поэтому:
 *
 *     node scripts/qstore-dedupe-report.js            # только отчёт
 *     node scripts/qstore-dedupe-report.js --apply    # удалить дубли
 *
 * Что считается дублем: совпадение названия И цены. Оставляется САМАЯ РАННЯЯ
 * запись — у неё дольше история, на неё могли ссылаться. Товары с продажами
 * (salesCount > 0) не трогаются НИКОГДА, даже если выглядят дублями: за ними
 * стоят деньги и покупатель.
 */
const BASE = process.env.API_BASE || "https://api.aevion.app";
const APPLY = process.argv.includes("--apply");

async function main() {
  const r = await fetch(`${BASE}/api/qstore/products?limit=200`);
  if (!r.ok) { console.error(`Не удалось получить список: HTTP ${r.status}`); process.exit(2); }
  const { products = [] } = await r.json();

  const groups = new Map();
  for (const p of products) {
    const key = `${p.title}||${p.price}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const dupes = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`Всего записей: ${products.length}`);
  console.log(`Уникальных (название+цена): ${groups.size}`);
  console.log(`Групп с дублями: ${dupes.length}`);

  let toDelete = [];
  for (const [key, list] of dupes) {
    const sorted = [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const keep = sorted[0];
    const rest = sorted.slice(1);
    const withSales = rest.filter((p) => Number(p.salesCount || 0) > 0);
    const safe = rest.filter((p) => Number(p.salesCount || 0) === 0);
    console.log(`\n${key.split("||")[0]}`);
    console.log(`  оставить: ${keep.id} (создан ${keep.createdAt})`);
    if (withSales.length) console.log(`  НЕ трогаю (есть продажи): ${withSales.map((p) => p.id).join(", ")}`);
    if (safe.length) console.log(`  удалить: ${safe.map((p) => p.id).join(", ")}`);
    toDelete.push(...safe);
  }

  console.log(`\nИтого к удалению: ${toDelete.length}`);
  if (!APPLY) {
    console.log("Это сухой прогон. Чтобы удалить — запустите с --apply.");
    return;
  }
  const token = process.env.QSTORE_ADMIN_TOKEN;
  if (!token) { console.error("Нужен QSTORE_ADMIN_TOKEN — удаление требует авторизации."); process.exit(2); }
  let ok = 0, fail = 0;
  for (const p of toDelete) {
    const d = await fetch(`${BASE}/api/qstore/me/products/${encodeURIComponent(p.id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (d.ok) { ok++; } else { fail++; console.error(`  не удалось ${p.id}: HTTP ${d.status}`); }
  }
  console.log(`Удалено: ${ok}, с ошибкой: ${fail}`);
}

main().catch((e) => { console.error("Сбой:", e.message); process.exit(2); });
