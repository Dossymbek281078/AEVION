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
  // 17.09.2026. С переходом на лестницу сроков таблица в коде собирается ВЫЧИСЛЕНИЕМ
  // (Object.fromEntries из TERM_TIERS и STANDALONE_APPS), литеральных пар в файле не осталось,
  // и регулярка выше вернула ПУСТО. Пустая таблица красит каждый товар витрины в «не опознан»:
  // прогон дал 23 ложные находки при нуле настоящих. Поэтому имена, которых нет литералами,
  // достраиваем ровно тем же шаблоном, что и код.
  for (const [imya, ssylka] of Object.entries(generatedNames())) {
    const k = normName(imya);
    if (!(k in map)) map[k] = ssylka;
  }
  return map;
}

/** Ступени сроков и отдельные приложения из pricing.ts. Разбор строковый: регулярки по этому файлу хрупки. */
function readLadder() {
  const src = fs.readFileSync(PRICING_TS, "utf8");
  const cut = (start, close) => {
    const i = src.indexOf(start);
    if (i < 0) return "";
    const j = src.indexOf(close, i + start.length);
    return j < 0 ? "" : src.slice(i + start.length, j);
  };
  const clean = (s) => s.trim().split('"').join("").split("'").join("").trim();
  const tiers = cut("export const TERM_TIERS = [", "]").split(",").map(clean).filter(Boolean);
  const pairs = (block) => {
    const out = {};
    for (const part of block.split(",")) {
      const i = part.indexOf(":");
      if (i < 0) continue;
      const k = clean(part.slice(0, i));
      const v = clean(part.slice(i + 1));
      if (k && v) out[k] = v;
    }
    return out;
  };
  const names = pairs(cut("export const TERM_NAME: Record<TermTier, string> = {", "}"));
  const months = pairs(cut("export const TERM_MONTHS: Record<TermTier, number> = {", "}"));
  const apps = [];
  for (const chunk of cut("export const STANDALONE_APPS: StandaloneApp[] = [", "];").split("}")) {
    const slug = chunk.indexOf("slug:");
    const name = chunk.indexOf("name:");
    if (slug < 0 || name < 0) continue;
    const val = (from) => {
      const a = chunk.indexOf('"', from);
      const b = chunk.indexOf('"', a + 1);
      return a < 0 || b < 0 ? "" : chunk.slice(a + 1, b);
    };
    const s = val(slug);
    const n = val(name);
    if (s && n) apps.push({ slug: s, name: n });
  }
  return { tiers, names, months, apps };
}

/** Названия товаров, как их строит код: «AEVION Planet — Lite (1 mo)», «AEVION DevHub — Max (12 mo)». */
function generatedNames() {
  const { tiers, names, months, apps } = readLadder();
  const out = {};
  if (!tiers.length || !Object.keys(names).length || !Object.keys(months).length) return out;
  for (const t of tiers) {
    if (!names[t] || !months[t]) continue;
    out["AEVION Planet — " + names[t] + " (" + months[t] + " mo)"] = "tier_" + t;
    for (const a of apps) {
      out["AEVION " + a.name + " — " + names[t] + " (" + months[t] + " mo)"] = "app_" + a.slug + "_" + t;
    }
  }
  return out;
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
  const items = [];
  // 17.09.2026. Разбор посошный: от КАЖДОЙ ссылки кассы берём первый <h2> после
  // неё и его <p>. Прежняя одна регулярка требовала «$X/период» и на товаре с
  // ценой-диапазоном перескакивала к СЛЕДУЮЩЕМУ товару — то есть записывала
  // ссылку одного товара с названием и ценой другого. Замер: ссылка
  // 03a0022c (настоящий «AEVION Planet», $24.00 - $2,400.00) числилась как
  // «AEVION Planet — Annual» $200/month. А checkoutId — ключ сверки с каталогом
  // сайта, значит проверка цен сравнивала каталог одного товара с ценой соседа.
  const сжать = (s) =>
    s
      .split(String.fromCharCode(10)).join(" ")
      .split(String.fromCharCode(13)).join(" ")
      .split(String.fromCharCode(9)).join(" ")
      .split(String.fromCharCode(160)).join(" ");
  const водну = (s) => {
    let r = сжать(s);
    while (r.indexOf("  ") >= 0) r = r.split("  ").join(" ");
    return r.trim();
  };
  const метка = "/checkout/buy/";
  for (let i = html.indexOf(метка); i >= 0; i = html.indexOf(метка, i + 1)) {
    const checkoutId = html.slice(i + метка.length, i + метка.length + 36);
    const h2 = html.indexOf("<h2", i);
    if (h2 < 0) continue;
    const ho = html.indexOf(">", h2);
    const hc = html.indexOf("</h2>", ho);
    if (ho < 0 || hc < 0) continue;
    const name = normName(водну(html.slice(ho + 1, hc)));
    if (!name) continue;
    // Цена известна, только когда она названа одним числом с периодом.
    // «$24.00 - $2,400.00» у товара с вариантами оставляем null: проверки цен
    // такой товар пропускают, проверки имён — нет.
    let priceUsd = null;
    let period = null;
    const p = html.indexOf("<p", hc);
    if (p >= 0) {
      const po = html.indexOf(">", p);
      const pc = html.indexOf("</p>", po);
      if (po >= 0 && pc >= 0) {
        const текст = водну(html.slice(po + 1, pc));
        const диапазон = текст.indexOf(" - ") >= 0;
        const дробь = текст.indexOf("/");
        if (!диапазон && текст.startsWith("$") && дробь > 0) {
          const число = parseFloat(текст.slice(1, дробь).split(",").join("").trim());
          if (!Number.isNaN(число)) {
            priceUsd = число;
            period = текст.slice(дробь + 1).trim().toLowerCase();
          }
        }
      }
    }
    items.push({ checkoutId, name, priceUsd, period });
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

  // НОЛЬ — не единственный признак сломанного разбора, и это важнее самого
  // нуля. Поменяйся разметка витрины чуть-чуть, и регулярка разберёт, скажем,
  // 12 товаров из 17: проверки молча охватят меньше, а вывод останется
  // зелёным. Прогон бывает НЕПОЛНЫМ и выглядит успешным.
  //
  // Знаменатель у нас есть, и он независимый: справочник ссылок в коде.
  // Товаров на витрине не может быть меньше, чем ссылок, которые мы же на
  // неё и завели.
  // 17.09.2026. Знаменатель был ложный: число имён В КОДЕ. Он годился, пока карта
  // повторяла витрину один к одному. С лестницей сроков код объявляет 30 сочетаний,
  // а магазин продаёт их ОДНИМ товаром с вариантами: 17 товаров против 30 имён —
  // и сверка отказывалась судить всегда, то есть молчала бы и о настоящем расхождении.
  // Честный знаменатель лежит в той же странице: сколько на ней ссылок кассы.
  const ssylok = html.split("/checkout/buy/").length - 1;
  if (store.length < ssylok) {
    console.error(
      `storefront-vs-code: разобрано ${store.length} товаров при ${ssylok} ссылках кассы на странице — ` +
        "разбор НЕПОЛОН, судить по нему нельзя. Частая причина: цена указана диапазоном " +
        "(«$24.00 - $2,400.00» у товара с вариантами), а разбор ждёт «$X/период»"
    );
    process.exitCode = 2;
    return;
  }
  // Сколько имён кода не встретилось на витрине — это НЕ повод отказываться судить
  // (у товара с вариантами имя одно, а ссылок в коде пять), но знать полезно.
  const imenVKode = Object.keys(nameMap).length;

  const byName = new Map(store.map((i) => [i.name, i]));
  const nahodki = [];

  // 1. Ссылка из кода без живого товара.
  //
  // 17.09.2026. Лестница сроков (30 позиций) продаётся ВАРИАНТАМИ внутри одного
  // товара «AEVION Planet», а публичная страница магазина вариантов не показывает
  // вовсе. Печатать по каждой такой позиции «НЕТ ТОВАРА» — изображать 30 расхождений
  // там, где их ноль: в списке из 54 строк 30 были заведомо ложными по устройству,
  // а список, где ложного больше половины, перестают читать вместе с настоящим.
  // Поэтому здесь ГРАНИЦА одной строкой, а не находки.
  //
  // Молчать можно ровно до тех пор, пока НОСИТЕЛЬ вариантов жив. Нет на витрине
  // товара с ценой-диапазоном — лестницу продавать нечем, и это находка, а не
  // граница. Проверяется подменой диапазона на «$400.00/month»: носителя не
  // остаётся, и строка обязана покраснеть.
  const lestnica = new Set(Object.keys(generatedNames()).map(normName));
  const nositel = store.find((i) => i.priceUsd == null);
  const nesudimy = [];
  for (const [name, ref] of Object.entries(nameMap)) {
    if (byName.has(name)) continue;
    if (lestnica.has(name)) {
      nesudimy.push(`${name} (${ref})`);
      continue;
    }
    nahodki.push(`НЕТ ТОВАРА: код знает "${name}" (${ref}), на витрине его нет`);
  }
  if (nesudimy.length && !nositel) {
    nahodki.push(
      `ЛЕСТНИЦА: на витрине НЕТ товара с вариантами, а ${nesudimy.length} позиций лестницы продаются только им — продавать их нечем`
    );
  } else if (nesudimy.length) {
    console.log(
      `ГРАНИЦА ПРОВЕРКИ: ${nesudimy.length} позиций лестницы сроков по витрине судить НЕЛЬЗЯ — ` +
        `они продаются вариантами товара «${nositel.name}», а публичная страница вариантов не показывает. ` +
        "Поимённо: --подробно"
    );
    if (process.argv.includes("--подробно")) for (const s of nesudimy) console.log("   " + s);
  }

  // 2. Период списания против названия. Это и есть класс, который нашёлся.
  for (const it of store) {
    // У товара с вариантами периода и цены нет (их несколько) — судить не о чем.
    // Без этого пропуска он давал бы ложные находки «списывает null».
    if (it.period == null || it.priceUsd == null) continue;
    const godovoi = /annual/i.test(it.name);
    const mesyachnyi = /monthly/i.test(it.name);
    if (godovoi && it.period !== "year")
      nahodki.push(`ПЕРИОД: "${it.name}" называется годовым, а списывает ${it.period} ($${it.priceUsd})`);
    if (mesyachnyi && it.period !== "month")
      nahodki.push(`ПЕРИОД: "${it.name}" называется месячным, а списывает ${it.period} ($${it.priceUsd})`);
  }

  // 3. Цена тарифа против объявленной.
  for (const it of store) {
    // Товар с вариантами показывает диапазон, а не одну цену. Контрольный прогон
    // без этой строки дал «ЦЕНА: тариф max продаётся ($null/null)» — находку,
    // которой нет: сравнивать не с чем, пока цена не названа одним числом.
    if (it.priceUsd == null) continue;
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
    if (!nameMap[it.name]) nahodki.push(`НЕ ОПОЗНАН: на витрине "${it.name}" (${it.priceUsd == null ? "цена вариантами" : "$" + it.priceUsd + "/" + it.period}), в коде такого названия нет`);
  }

  // 5. Цена в магазине против цены в каталоге САЙТА, по точному ключу —
  //    идентификатору кассы. Тут допущений нет вовсе: один и тот же товар,
  //    два источника. Замер 13.09: совпало 7 из 7 до цента.
  const katalog = readCatalogByCheckoutId();
  for (const it of store) {
    const k = katalog[it.checkoutId];
    if (!k) continue;
    // Цена вариантами (null) — сравнивать не с чем. Без этой защиты
    // Math.abs(k.priceUsd - null) равен самой цене каталога, то есть всегда
    // больше порога: товар с диапазоном давал бы «КАТАЛОГ: … против $null».
    if (it.priceUsd != null && Math.abs(k.priceUsd - it.priceUsd) > 0.009)
      nahodki.push(`КАТАЛОГ: "${it.name}" в магазине $${it.priceUsd}, на сайте позиция ${k.id} стоит $${k.priceUsd}`);
    const ozhidaem = k.billing === "monthly" ? "month" : k.billing === "annual" ? "year" : null;
    if (ozhidaem && it.period != null && it.period !== ozhidaem)
      nahodki.push(`КАТАЛОГ: "${it.name}" в магазине списывает ${it.period}, на сайте позиция ${k.id} объявлена как ${k.billing}`);
  }

  // 6. Товар модуля продаётся в магазине, а на сайте не выставлен вовсе.
  //    Тарифы сюда не попадают намеренно: их продаёт страница цен, а не
  //    каталог, и их отсутствие в products.ts — норма.
  for (const it of store) {
    const ref = nameMap[it.name];
    if (!ref || !ref.startsWith("app_")) continue;
    if (!katalog[it.checkoutId])
      nahodki.push(`НЕ НА САЙТЕ: "${it.name}" (${it.priceUsd == null ? "цена вариантами" : "$" + it.priceUsd + "/" + it.period}) продаётся в магазине, но в каталоге сайта его нет`);
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
  const gumMap = readGumroadMapping();
  if (gumMap === null) {
    console.error("storefront-vs-code: соответствие слагов в gumroadWebhook.ts не найдено — проверять нечем");
    process.exitCode = 2;
    return;
  }
  // Тот же знаменатель для второй кассы: сопоставлений в коде столько-то,
  // товаров на витрине не может быть меньше.
  if (gumStore.length < Object.keys(gumMap).length) {
    console.error(
      `storefront-vs-code: Gumroad разобрано ${gumStore.length} товаров при ` +
        `${Object.keys(gumMap).length} сопоставлениях в коде — разбор НЕПОЛОН`
    );
    process.exitCode = 2;
    return;
  }
  const gumKatalog = readCatalogByGumSlug();

  for (const it of gumStore) {
    if (!gumMap[it.slug])
      // 17.09.2026. Было «покупка уйдёт в общую ветку» — общей ветки нет с августа:
      // неизвестный товар даёт 500 unmapped_product и ничего не выдаёт. И сверка видит
      // только ЗАШИТУЮ карту, а товар бывает узнан переменной прода (ветки 1–1в вебхука)
      // и под другой формой адреса (tycfw отвечает 301 на aevion-lite). Поэтому утверждаем
      // ровно то, что измерено, и называем, чего не видно.
      nahodki.push(
        `GUMROAD БЕЗ СОПОСТАВЛЕНИЯ В КОДЕ: "${it.name}" (${it.slug}, $${it.priceUsd}) — в зашитой карте нет; ` +
          "если и переменные прода его не узнают, покупка даст 500 без доступа (сверка переменных не видит)"
      );
  }
  // 17.09.2026. Здесь стояло «на витрине его нет — ссылка «купить» мертва». Это был
  // ВЫВОД из отсутствия, а не замер, и он оказался ложным: orcfbo, lelzw и ghvzq
  // отвечают 200 по той самой ссылке, которую строит сайт (`?wanted=true`), — они
  // просто не показаны на публичной витрине, в Gumroad товар бывает unlisted.
  // Теперь спрашиваем саму ссылку. Контроль прибора: выдуманный слаг даёт 404.
  const netNaVitrine = Object.keys(gumMap).filter((slug) => !gumStore.some((it) => it.slug === slug));
  const neposkazany = [];
  for (const slug of netNaVitrine) {
    if (GUMROAD_HTML) {
      // Витрина читалась из файла: сети мы не касались, значит про ссылку сказать
      // нечего. Молчание честнее выдуманного вердикта в обе стороны.
      neposkazany.push(`${slug} (ссылка НЕ проверялась: витрина читалась из файла)`);
      continue;
    }
    let status = null;
    try {
      const r = await fetch(`https://aevion.gumroad.com/l/${slug}?wanted=true`, {
        headers: { "user-agent": "Mozilla/5.0 (aevion-storefront-check)" },
      });
      status = r.status;
    } catch (e) {
      status = "нет ответа: " + e.message;
    }
    if (typeof status === "number" && status >= 200 && status < 300) {
      neposkazany.push(`${slug} (не показан на витрине, ссылка отвечает ${status})`);
    } else {
      nahodki.push(`GUMROAD ССЫЛКА МЕРТВА: слаг ${slug} известен коду, страница покупки отвечает ${status}`);
    }
  }
  if (neposkazany.length) {
    console.log(
      `ГРАНИЦА ПРОВЕРКИ: ${neposkazany.length} слагов Gumroad на витрине не показаны — это НЕ поломка: ` +
        neposkazany.join(", ")
    );
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
