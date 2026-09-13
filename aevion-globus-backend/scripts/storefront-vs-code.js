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
const CATALOG_TS = path.resolve(__dirname, "../../frontend/src/lib/products.ts");
const GUMROAD_STORE = process.env.GUMROAD_STORE_URL || "https://aevion.gumroad.com";
const GUMROAD_HTML = process.env.GUMROAD_HTML_PATH || null;
const WEBHOOK_TS = path.resolve(__dirname, "../src/routes/gumroadWebhook.ts");

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

/** Позиции каталога сайта, у которых касса LemonSqueezy. Ключ — идентификатор
 *  кассы: он одинаков у нас и в магазине, в отличие от названий. */
function readCatalogByCheckoutId() {
  const src = fs.readFileSync(CATALOG_TS, "utf8");
  const starts = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => ({ pos: m.index, id: m[1] }));
  const out = {};
  for (let k = 0; k < starts.length; k++) {
    const blok = src.slice(starts[k].pos, k + 1 < starts.length ? starts[k + 1].pos : src.length);
    const ls = blok.match(/href:\s*LS\("([^"]+)"\)/);
    const cena = blok.match(/priceUsd:\s*([\d.]+)/);
    const bill = blok.match(/billing:\s*"(monthly|once)"/);
    if (ls && cena) out[ls[1]] = { id: starts[k].id, priceUsd: parseFloat(cena[1]), billing: bill ? bill[1] : "?" };
  }
  return out;
}

/** Позиции каталога сайта с кассой Gumroad, ключ — слаг товара. */
function readCatalogByGumSlug() {
  const src = fs.readFileSync(CATALOG_TS, "utf8");
  const starts = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => ({ pos: m.index, id: m[1] }));
  const out = {};
  for (let k = 0; k < starts.length; k++) {
    const blok = src.slice(starts[k].pos, k + 1 < starts.length ? starts[k + 1].pos : src.length);
    const gum = blok.match(/href:\s*GUM\("([^"]+)"\)/);
    const cena = blok.match(/priceUsd:\s*([\d.]+)/);
    const bill = blok.match(/billing:\s*"(monthly|once)"/);
    if (gum && cena) out[gum[1]] = { id: starts[k].id, priceUsd: parseFloat(cena[1]), billing: bill ? bill[1] : "?" };
  }
  return out;
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

/** Слаги Gumroad, для которых код ЗНАЕТ, что выдавать. Без сопоставления
 *  покупка проваливается в общую ветку: 27 и 29 мая и 2 июня так продали
 *  книгу за $9.99 и выдали за неё платный ТАРИФ. */
function readGumroadMapping() {
  const src = fs.readFileSync(WEBHOOK_TS, "utf8");
  const i = src.indexOf("KNOWN_PERMALINK_REFERENCE");
  if (i < 0) return null;
  const blok = src.slice(i, src.indexOf("};", i));
  const out = {};
  for (const m of blok.matchAll(/^\s*([a-z0-9]+):\s*"([^"]+)"/gm)) out[m[1]] = m[2];
  return out;
}

/** Товары с публичного профиля Gumroad: слаг, имя, цена, период. */
function parseGumroad(html) {
  const plain = html.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const out = [];
  const re = /"permalink":"([a-z0-9]+)","name":"([^"]*)"[\s\S]{0,600}?"price_cents":(\d+)[\s\S]{0,400}?"recurrence":(null|"[a-z]+")/g;
  let m;
  while ((m = re.exec(plain))) {
    out.push({
      slug: m[1],
      name: m[2],
      priceUsd: Number(m[3]) / 100,
      recurrence: m[4] === "null" ? null : m[4].replace(/"/g, ""),
    });
  }
  return out;
}

async function fetchGumroad() {
  if (GUMROAD_HTML) return fs.readFileSync(path.resolve(GUMROAD_HTML), "utf8");
  const r = await fetch(GUMROAD_STORE, { headers: { "user-agent": "Mozilla/5.0 (aevion-storefront-check)" } });
  if (!r.ok) throw new Error("витрина Gumroad ответила " + r.status);
  return await r.text();
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
  // Ссылка кассы идёт ПЕРЕД названием — берём её тем же проходом: это
  // ТОЧНЫЙ ключ сверки с каталогом сайта. Сопоставлять по именам нельзя:
  // `app_smeta` в коде против `smeta-trainer` в каталоге, и таких пар
  // несколько — по именам сверка давала бы ложные срабатывания.
  const re = /href="[^"]*\/checkout\/buy\/([0-9a-f-]{36})"[\s\S]*?<h2[^>]*>\s*([^<]+?)\s*<\/h2>\s*<p[^>]*>\s*\$([\d.,]+)\/(\w+)\s*<\/p>/g;
  let m;
  while ((m = re.exec(flat))) {
    items.push({
      checkoutId: m[1],
      name: normName(m[2]),
      priceUsd: parseFloat(m[3].replace(/,/g, "")),
      period: m[4].toLowerCase(),
    });
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

  // 5. Цена в магазине против цены в каталоге САЙТА, по точному ключу —
  //    идентификатору кассы. Тут допущений нет вовсе: один и тот же товар,
  //    два источника. Замер 13.09: совпало 7 из 7 до цента.
  const katalog = readCatalogByCheckoutId();
  for (const it of store) {
    const k = katalog[it.checkoutId];
    if (!k) continue;
    if (Math.abs(k.priceUsd - it.priceUsd) > 0.009)
      nahodki.push(`КАТАЛОГ: "${it.name}" в магазине $${it.priceUsd}, на сайте позиция ${k.id} стоит $${k.priceUsd}`);
    const ozhidaem = k.billing === "monthly" ? "month" : k.billing === "annual" ? "year" : null;
    if (ozhidaem && it.period !== ozhidaem)
      nahodki.push(`КАТАЛОГ: "${it.name}" в магазине списывает ${it.period}, на сайте позиция ${k.id} объявлена как ${k.billing}`);
  }

  // 6. Товар модуля продаётся в магазине, а на сайте не выставлен вовсе.
  //    Тарифы сюда не попадают намеренно: их продаёт страница цен, а не
  //    каталог, и их отсутствие в products.ts — норма.
  for (const it of store) {
    const ref = nameMap[it.name];
    if (!ref || !ref.startsWith("app_")) continue;
    if (!katalog[it.checkoutId])
      nahodki.push(`НЕ НА САЙТЕ: "${it.name}" ($${it.priceUsd}/${it.period}) продаётся в магазине, но в каталоге сайта его нет`);
  }

  // ── Вторая касса: Gumroad ────────────────────────────────────────────────
  // Главное здесь не цены (их сверяет catalog-vs-checkout), а ПОЛНОТА
  // СОПОСТАВЛЕНИЯ. Товар, которого нет в KNOWN_PERMALINK_REFERENCE, при покупке
  // проваливается в общую ветку: 27 и 29 мая и 2 июня так продали книгу за
  // $9.99 и выдали за неё платный ТАРИФ. Это единственная проверка, которая
  // ловит такой товар ДО первой продажи.
  let gumStore = null;
  try {
    gumStore = parseGumroad(await fetchGumroad());
  } catch (e) {
    console.error("storefront-vs-code: витрину Gumroad прочитать НЕ удалось — " + e.message);
    process.exitCode = 2;
    return;
  }
  if (gumStore.length === 0) {
    console.error("storefront-vs-code: на витрине Gumroad не разобрано НИ ОДНОГО товара — разбор сломан");
    process.exitCode = 2;
    return;
  }
  const gumMap = readGumroadMapping();
  if (gumMap === null) {
    console.error("storefront-vs-code: соответствие слагов в gumroadWebhook.ts не найдено — проверять нечем");
    process.exitCode = 2;
    return;
  }
  const gumKatalog = readCatalogByGumSlug();

  for (const it of gumStore) {
    if (!gumMap[it.slug])
      nahodki.push(`GUMROAD БЕЗ СОПОСТАВЛЕНИЯ: "${it.name}" (${it.slug}, $${it.priceUsd}) — покупка уйдёт в общую ветку`);
  }
  for (const slug of Object.keys(gumMap)) {
    if (!gumStore.some((it) => it.slug === slug))
      nahodki.push(`GUMROAD НЕТ ТОВАРА: код знает слаг ${slug}, на витрине его нет — ссылка «купить» мертва`);
  }
  for (const it of gumStore) {
    const k = gumKatalog[it.slug];
    if (!k) continue;
    if (Math.abs(k.priceUsd - it.priceUsd) > 0.009)
      nahodki.push(`GUMROAD ЦЕНА: "${it.name}" в кассе $${it.priceUsd}, на сайте позиция ${k.id} стоит $${k.priceUsd}`);
    const povtor = it.recurrence ? "monthly" : "once";
    if (k.billing !== "?" && k.billing !== povtor)
      nahodki.push(`GUMROAD ПЕРИОД: "${it.name}" в кассе ${povtor}, на сайте позиция ${k.id} объявлена как ${k.billing}`);
  }

  console.log(`storefront-vs-code: товаров на витрине ${store.length}, ссылок в коде ${Object.keys(nameMap).length}; Gumroad: товаров ${gumStore.length}, сопоставлений ${Object.keys(gumMap).length}`);

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
