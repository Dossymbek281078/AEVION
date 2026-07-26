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
 * ОБА процессора проверяются без браузера: и Gumroad, и LemonSqueezy кладут данные
 * товара прямо в HTML — Gumroad экранированным JSON с price_cents, LS объектом заказа
 * с "price"/"is_subscription"/"interval".
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
  // К каждой позиции — её реальная ссылка оплаты: у Gumroad permalink, у LS uuid варианта.
  const links = {};
  const lre = /id:\s*"([^"]+)",[\s\S]*?href:\s*(GUM|LS)\("([^"]+)"\)/g;
  while ((m = lre.exec(src))) links[m[1]] = { processor: m[2] === "GUM" ? "gumroad" : "lemonsqueezy", ref: m[3] };
  return items.map((i) => ({ ...i, ...(links[i.id] || { processor: "unknown", ref: null }) }));
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

async function checkLemonSqueezy(item) {
  const url = `https://aevion.lemonsqueezy.com/checkout/buy/${item.ref}`;

  // ⚠️ КОНТРИНТУИТИВНО, но воспроизведено 26.07.2026: LS отдаёт настоящую страницу
  // только НЕ-браузерному User-Agent. С «Mozilla/5.0 Chrome» и вовсе без UA приходит
  // 404 — причём телом на 261 КБ, то есть страница-обманка, а не пустой ответ.
  // С «curl/8.7.1» приходит 200 и 282 КБ с объектом заказа. Не «упрощать» этот
  // заголовок: без него скрипт выдаёт семь несуществующих 404.
  const r = await fetch(url, {
    headers: { Accept: "*/*", "User-Agent": "curl/8.7.1" },
    redirect: "follow",
  });
  if (!r.ok) return { status: "FAIL", why: `чекаут отдал HTTP ${r.status}` };
  const data = (await r.text()).replace(/&quot;/g, '"');

  const problems = [];
  const cents = Math.round(item.priceUsd * 100);

  const priceMatch = data.match(/"price":\s*(\d+)\s*,\s*"is_subscription":\s*(true|false)/);
  if (!priceMatch) {
    return { status: "FAIL", why: "полей price/is_subscription нет — формат страницы изменился" };
  }
  const [, gotCents, isSub] = priceMatch;
  if (Number(gotCents) !== cents) problems.push(`ожидалась цена ${cents}¢, в чекауте ${gotCents}¢`);

  const interval = (data.match(/"interval":"([a-z]+)"/) || [])[1];
  const monthly = isSub === "true" && interval === "month";
  if (item.billing === "monthly" && !monthly) {
    problems.push(`в каталоге помесячно, а чекаут: is_subscription=${isSub}, interval=${interval || "нет"}`);
  }
  if (item.billing === "once" && monthly) {
    problems.push("в каталоге разовая покупка, а чекаут объявляет ежемесячную подписку");
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
    if (!item.ref) {
      skip++;
      console.log(`SKIP  ${item.id.padEnd(10)} ссылку оплаты в каталоге разобрать не удалось`);
      continue;
    }
    let res;
    try {
      res = item.processor === "gumroad" ? await checkGumroad(item) : await checkLemonSqueezy(item);
    } catch (e) {
      res = { status: "FAIL", why: `запрос не прошёл: ${e.message}` };
    }
    if (res.status === "OK") {
      ok++;
      console.log(`OK    ${item.id.padEnd(10)} $${item.priceUsd}${item.billing === "monthly" ? "/мес" : ""}  (${item.processor})`);
    } else {
      fail++;
      failures.push(`${item.id}: ${res.why}`);
      console.log(`FAIL  ${item.id.padEnd(10)} ${res.why}`);
    }
  }

  console.log(
    `\ncatalog-vs-checkout: ${ok} OK, ${fail} FAIL, ${skip} SKIP`,
  );
  if (failures.length) {
    console.log("\nРасхождения:");
    for (const f of failures) console.log(`  • ${f}`);
  }
  process.exit(fail ? 1 : 0);
})();
