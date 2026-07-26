/**
 * Сверка каталога товаров с ЖИВЫМИ карточками оплаты.
 *
 * ЗАЧЕМ. 26.07.2026 за одно окно нашлось четыре расхождения, и все — одного класса:
 * внутренние источники репозитория были согласованы между собой и одинаково неверны.
 *   - семь модулей продавались как «разовая лицензия», а LemonSqueezy списывает ежемесячно;
 *   - Constitution рекламировался как IP-регистратор, а это симулятор политэкономии;
 *   - /qpaynet и /qcontract объявляют себя демонстрацией, но продаются как рабочие;
 *   - на карточке стояло «500k пазлов» при «400 puzzles» на живой странице.
 * Ни одно из них не ловится тестами по коду: страницы отдают 200 и выглядят живыми.
 * Ловится только сверкой с тем, что видит покупатель. Этот скрипт делает её сам.
 *
 * Запуск:  node scripts/catalog-vs-checkout.js
 * Код возврата 1 — есть расхождения (годится для CI/еженедельного крона).
 *
 * ЧЕГО СКРИПТ НЕ ПРОВЕРЯЕТ (и честно об этом говорит вместо молчаливого «ок»):
 * чекауты LemonSqueezy рисуются джаваскриптом, из Node их текст не виден. Такие
 * позиции помечаются SKIP и требуют браузерной проверки (Playwright). Молча
 * засчитывать их успехом нельзя — именно так и рождается ложное «всё сходится».
 */

const fs = require("fs");
const path = require("path");

const CATALOG = path.resolve(__dirname, "../../frontend/src/lib/products.ts");

/** Разбор каталога регуляркой: фронт и бэк — раздельные TS-проекты, импорта нет. */
function readCatalog() {
  const src = fs.readFileSync(CATALOG, "utf8");
  const items = [];
  const re = /id:\s*"([^"]+)",[\s\S]*?priceUsd:\s*([\d.]+),[\s\S]*?billing:\s*"(monthly|once)"/g;
  let m;
  while ((m = re.exec(src))) {
    items.push({ id: m[1], priceUsd: parseFloat(m[2]), billing: m[3] });
  }
  const gumroad = new Set();
  const gre = /GUM\("([^"]+)"\)/g;
  while ((m = gre.exec(src))) gumroad.add(m[1]);
  return items.map((i) => ({ ...i, processor: gumroad.has(i.id) ? "gumroad" : "lemonsqueezy" }));
}

async function checkGumroad(item) {
  const url = `https://aevion.gumroad.com/l/${item.id}`;
  const r = await fetch(url, { headers: { Accept: "text/html" } });
  if (!r.ok) return { status: "FAIL", why: `карточка отдала HTTP ${r.status}` };
  const html = await r.text();

  // Карточка рисуется джаваскриптом, но данные о товаре лежат в HTML в виде
  // ЭКРАНИРОВАННОГО JSON (&quot;price_cents&quot;:5900). Проверять видимый текст
  // бесполезно — первая версия этого скрипта именно так и выдала девять ложных
  // FAIL. Разэкранируем и читаем сами поля.
  const data = html.replace(/&quot;/g, '"');

  const problems = [];

  const cents = Math.round(item.priceUsd * 100);
  if (!new RegExp(`"price_cents":\\s*${cents}\\b`).test(data)) {
    const seen = [...data.matchAll(/"price_cents":\s*(\d+)/g)].map((m) => m[1]).slice(0, 3);
    problems.push(`ожидалась цена ${cents}¢, в карточке ${seen.length ? seen.join("/") + "¢" : "поля нет"}`);
  }

  const isMonthly = /"recurrence":"monthly"|"recurrence_price_values":\{"monthly"/.test(data);
  if (item.billing === "monthly" && !isMonthly) {
    problems.push("в каталоге помесячно, а карточка не объявляет месячную периодичность");
  }
  if (item.billing === "once" && isMonthly) {
    problems.push("в каталоге разовая покупка, а карточка объявляет ежемесячное списание");
  }

  return problems.length ? { status: "FAIL", why: problems.join("; ") } : { status: "OK", why: "" };
}

(async () => {
  const catalog = readCatalog();
  if (!catalog.length) {
    console.error("каталог не разобран — проверь формат products.ts");
    process.exit(1);
  }

  console.log(`catalog-vs-checkout: позиций в каталоге ${catalog.length}\n`);

  let ok = 0;
  let fail = 0;
  let skip = 0;
  const failures = [];

  for (const item of catalog) {
    if (item.processor !== "gumroad") {
      skip++;
      console.log(`SKIP  ${item.id.padEnd(10)} $${item.priceUsd} — чекаут LemonSqueezy рисуется JS, нужна браузерная проверка`);
      continue;
    }
    let res;
    try {
      res = await checkGumroad(item);
    } catch (e) {
      res = { status: "FAIL", why: `запрос не прошёл: ${e.message}` };
    }
    if (res.status === "OK") {
      ok++;
      console.log(`OK    ${item.id.padEnd(10)} $${item.priceUsd} ${item.billing === "monthly" ? "/мес" : ""}`);
    } else {
      fail++;
      failures.push(`${item.id}: ${res.why}`);
      console.log(`FAIL  ${item.id.padEnd(10)} ${res.why}`);
    }
  }

  console.log(
    `\ncatalog-vs-checkout: ${ok} OK, ${fail} FAIL, ${skip} SKIP (LemonSqueezy — только через браузер)`,
  );
  if (failures.length) {
    console.log("\nРасхождения:");
    for (const f of failures) console.log(`  • ${f}`);
  }
  process.exit(fail ? 1 : 0);
})();
