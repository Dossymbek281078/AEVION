/**
 * Сверка ЖИВОЙ витрины магазина с тем, что знает код.
 *
 * ЗАЧЕМ. В коде есть таблица `STOREFRONT_NAME_TO_REFERENCE` — её завели
 * 13.08.2026 именно для этой сверки, сопоставив семнадцать товаров глазами.
 * Потребителя у таблицы не появилось: механизм собран, части не связаны.
 * Пока сверки нет, вопрос «а тем ли способом списывают деньги» решается
 * только покупкой.
 *
 * Что нашлось в первый же прогон 13.09.2026:
 *   AEVION Planet — Annual списывает $200.00/MONTH, тогда как Lite/Medium/Full
 *   — Annual честно списывают /year. Одна страница, один шаблон, разный вывод.
 *
 * Проверяет три вещи:
 *   1. у каждой ссылки из таблицы есть живой товар на витрине;
 *   2. период списания соответствует названию (Annual → year, Monthly → month);
 *   3. цена тарифа совпадает с объявленной у нас (TIERS).
 *
 * Запуск:  node scripts/storefront-vs-code.js
 * Коды:    0 — сходится, 1 — есть расхождения, 2 — витрину прочитать НЕ удалось
 *          (это не «всё хорошо»: неотвеченный вопрос не равен благополучию).
 *
 * Витрина читается обычным GET публичной страницы — ни ключей, ни сессий.
 */

const fs = require("fs");
const path = require("path");

const STORE = process.env.STOREFRONT_URL || "https://aevion.lemonsqueezy.com";
// Путь переопределяется ради негативного теста: подсовываем копию страницы.
const STORE_HTML = process.env.STOREFRONT_HTML_PATH || null;

const VARIANTS_TS = path.resolve(__dirname, "../src/data/lemonSqueezyVariants.ts");
const PRICING_TS = path.resolve(__dirname, "../src/data/pricing.ts");

/** Названия товаров -> ссылка в коде. Разбор регуляркой: это TS, а скрипт на JS. */
function readNameMap() {
  const src = fs.readFileSync(VARIANTS_TS, "utf8");
  const block = src.slice(src.indexOf("STOREFRONT_NAME_TO_REFERENCE"));
  const map = {};
  const re = /"([^"]+)":\s*"(tier_[a-z_]+|app_[a-z_]+)"/g;
  let m;
  while ((m = re.exec(block))) map[normName(m[1])] = m[2];
  return map;
}

/** Цены тарифов, как мы их ОБЪЯВЛЯЕМ. */
function readTierPrices() {
  const src = fs.readFileSync(PRICING_TS, "utf8");
  const out = {};
  const re = /id:\s*"(lite|medium|full|pro|planet)",[\s\S]{0,400}?priceMonthly:\s*(\d+)/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = { monthly: Number(m[2]), annualTotal: Number(m[2]) * 10 };
  return out;
}

/** Тире и неразрывные пробелы на витрине бывают разные — сводим к одному виду. */
function normName(s) {
  return s
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BASELINE = process.env.STOREFRONT_BASELINE_PATH
  ? path.resolve(process.env.STOREFRONT_BASELINE_PATH)
  : path.resolve(__dirname, "storefront-vs-code.baseline.json");

/** Известные расхождения. Файла нет — честный пустой список, а не отказ. */
function readBaseline() {
  if (!fs.existsSync(BASELINE)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    return Array.isArray(j.known) ? j.known : [];
  } catch (e) {
    // Битый файл — это НЕ «известных нет»: иначе все находки стали бы новыми
    // и прогон покраснел бы по чужой причине. Говорим прямо и падаем в 2.
    console.error("storefront-vs-code: базовая линия не читается — " + e.message);
    process.exitCode = 2;
    return null;
  }
}

async function fetchStore() {
  if (STORE_HTML) return fs.readFileSync(path.resolve(STORE_HTML), "utf8");
  const r = await fetch(STORE, { headers: { "user-agent": "Mozilla/5.0 (aevion-storefront-check)" } });
  if (!r.ok) throw new Error("витрина ответила " + r.status);
  return await r.text();
}

function parseStore(html) {
  const flat = html.replace(/\s+/g, " ");
  const items = [];
  const re = /<h2[^>]*>\s*([^<]+?)\s*<\/h2>\s*<p[^>]*>\s*\$([\d.,]+)\/(\w+)\s*<\/p>/g;
  let m;
  while ((m = re.exec(flat))) {
    items.push({ name: normName(m[1]), priceUsd: parseFloat(m[2].replace(/,/g, "")), period: m[3].toLowerCase() });
  }
  return items;
}

(async () => {
  let html;
  try {
    html = await fetchStore();
  } catch (e) {
    console.error("storefront-vs-code: витрину прочитать НЕ удалось — " + e.message);
    process.exitCode = 2;
    return;
  }

  const nameMap = readNameMap();
  const tiers = readTierPrices();
  const store = parseStore(html);

  if (store.length === 0) {
    console.error("storefront-vs-code: на витрине не разобрано НИ ОДНОГО товара — разбор сломан, а не магазин пуст");
    process.exitCode = 2;
    return;
  }

  const byName = new Map(store.map((i) => [i.name, i]));
  const nahodki = [];

  // 1. Ссылка из кода без живого товара.
  for (const [name, ref] of Object.entries(nameMap)) {
    if (!byName.has(name)) nahodki.push(`НЕТ ТОВАРА: код знает "${name}" (${ref}), на витрине его нет`);
  }

  // 2. Период списания против названия. Это и есть класс, который нашёлся.
  for (const it of store) {
    const godovoi = /annual/i.test(it.name);
    const mesyachnyi = /monthly/i.test(it.name);
    if (godovoi && it.period !== "year")
      nahodki.push(`ПЕРИОД: "${it.name}" называется годовым, а списывает ${it.period} ($${it.priceUsd})`);
    if (mesyachnyi && it.period !== "month")
      nahodki.push(`ПЕРИОД: "${it.name}" называется месячным, а списывает ${it.period} ($${it.priceUsd})`);
  }

  // 3. Цена тарифа против объявленной.
  for (const it of store) {
    const ref = nameMap[it.name];
    if (!ref || !ref.startsWith("tier_")) continue;
    const tier = ref.slice("tier_".length).replace(/_(monthly|annual)$/, "");
    const nash = tiers[tier];
    if (!nash) {
      nahodki.push(`ЦЕНА: тариф "${tier}" продаётся ($${it.priceUsd}/${it.period}), но в нашей таблице цен его НЕТ`);
      continue;
    }
    const zhdem = ref.endsWith("_annual") ? nash.annualTotal : nash.monthly;
    if (Math.abs(zhdem - it.priceUsd) > 0.009)
      nahodki.push(`ЦЕНА: "${it.name}" на витрине $${it.priceUsd}, у нас объявлено $${zhdem}`);
  }

  // 4. Живой товар, которого код не знает — не ошибка сама по себе, но выдать
  //    его нечем: сопоставления нет, значит и тариф по нему не назначить.
  for (const it of store) {
    if (!nameMap[it.name]) nahodki.push(`НЕ ОПОЗНАН: на витрине "${it.name}" ($${it.priceUsd}/${it.period}), в коде такого названия нет`);
  }

  console.log(`storefront-vs-code: товаров на витрине ${store.length}, ссылок в коде ${Object.keys(nameMap).length}`);

  // БАЗОВАЯ ЛИНИЯ. Скрипт ставится в ежедневный набор, а сегодня он красный
  // по известной причине (Planet). Красный с рождения сторож перестают
  // читать, поэтому известное записано в файл рядом и не роняет прогон.
  //
  // Список разрешено только СОКРАЩАТЬ: новое расхождение роняет, исчезнувшее
  // печатается как ПОЧИНКА и прогон не роняет. Иначе сторож ругался бы на
  // собственное исправление.
  const izvestnye = readBaseline();
  if (izvestnye === null) return; // базовая линия не прочитана, код уже 2
  const novye = nahodki.filter((x) => !izvestnye.includes(x));
  const ischezli = izvestnye.filter((x) => !nahodki.includes(x));

  for (const n of nahodki.filter((x) => izvestnye.includes(x))) console.log("  [известно] " + n);
  for (const n of ischezli) console.log("  [ПОЧИНЕНО, уберите из базовой линии] " + n);
  for (const n of novye) console.log("  [НОВОЕ] " + n);

  if (novye.length === 0) {
    console.log(
      `Новых расхождений нет (известных ${nahodki.length}` +
        (ischezli.length ? `, починено ${ischezli.length}` : "") + ")."
    );
    return;
  }
  console.log(`НОВЫХ расхождений: ${novye.length}`);
  process.exitCode = 1;
})();
