#!/usr/bin/env node
/**
 * Карта денег AEVION — что можно купить и куда за это платят, одной страницей.
 *
 * ЗАЧЕМ. 14.08.2026 основатель сказал: «сейчас как стоит монетизация, легко
 * можно запутаться». И был прав: поверхностей, где берут деньги, пять
 * (тарифы, модули поштучно, сборки, разовые товары, скидки), живут они в трёх
 * разных местах, и ответ на «сколько стоит вот это» приходилось собирать из
 * кода, двух кабинетов и головы. Ровно поэтому цена Конституции разошлась в
 * четырёх местах, а калькулятор считал по $19 то, за что касса берёт $49.
 *
 * ПОЧЕМУ СКРИПТ, А НЕ ДОКУМЕНТ. Первая версия карты была снимком одного дня и
 * протухла на следующий же. Здесь каждое число берётся запросом при каждом
 * запуске, а дата замера ставится не руками — то есть карту нельзя случайно
 * прочитать как «сегодня так», когда она собрана неделю назад.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Продажи Gumroad живут в кабинете за паролем; публичная
 * витрина их не отдаёт. Они лежат в SALES_SNAPSHOT с датой замера и подписаны
 * на странице как ручные — «не знаем» честнее, чем свежая с виду цифра.
 *
 * Запуск:  node scripts/money-map.mjs [путь-вывода.html]
 * Коды:    0 — карта собрана; 2 — источник не ответил, карта НЕ переписана.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT = process.argv[2] || resolve(REPO, "money-map.html");
const API = process.env.PROD_API || "https://api.aevion.app";
const LS_STORE = process.env.LS_STORE_URL || "https://aevion.lemonsqueezy.com/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/**
 * Продажи Gumroad. Обновляется вручную — кабинет за паролем, публичная витрина
 * продаж не отдаёт. Дата обязательна: без неё цифра выглядит сегодняшней.
 */
const SALES_SNAPSHOT = {
  measuredAt: "2026-08-14",
  bySlug: { orcfbo: { count: 3, usd: 29.97 } },
};

/** Названия модулей по-человечески. Что не названо — покажем идентификатором. */
const MODULE_RU = {
  "smeta-trainer": "Smeta Trainer", qventure: "QVenture", qfusionai: "QFusionAI",
  "aevion-ip-bureau": "IP Bureau", "qpaynet-embedded": "QPayNet", qpersona: "QPersona",
  "startup-exchange": "Startup Exchange", qreal: "QReal", "multichat-engine": "Multichat",
  cyberchess: "CyberChess", healthai: "HealthAI", qrenew: "QRenew", qai: "QAI",
  qlife: "QLife", "psyapp-deps": "PsyApp", qbuild: "QBuild", qcontract: "QContract",
  qtradeoffline: "QTrade Offline", qmelanin: "QMelanin", qlearn: "QLearn",
  qstore: "QStore", qmedia: "QMedia", qgood: "QGood", qcoreai: "QCoreAI",
  qright: "QRight", qsign: "QSign", qnews: "QNews", "kids-ai-content": "Kids AI",
  deepsan: "DeepSan", qevents: "QEvents", lifebox: "LifeBox", constitution: "Constitution",
  globus: "Globus", "revenue-hub": "Revenue Hub", ventures: "Ventures",
};

const TIER_RU = {
  free: "Бесплатно", lite: "Lite", medium: "Medium",
  full: "Full", pro: "Universe", enterprise: "Предприятие",
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
  if (!(res.status >= 200 && res.status < 300)) throw new Error(`${url} → ${res.status}`);
  // Читаем байтами: у прода в ответе кириллица, а неверная кодировка ломает
  // разбор на середине — это уже случалось при сборе первой карты.
  return JSON.parse(new TextDecoder("utf-8").decode(await res.arrayBuffer()));
}

/** Витрина подписок: название → цена. Разбор тот же, что в ls-catalog-drift. */
async function storefront() {
  const res = await fetch(LS_STORE, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
  if (!(res.status >= 200 && res.status < 300)) throw new Error(`витрина → ${res.status}`);
  const plain = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const out = new Map();
  for (const m of plain.matchAll(/(AEVION [A-Za-z0-9 —\-]{2,60}?)\s\$([\d.,]+)\/(month|year)/g)) {
    let name = m[1].trim();
    const i = name.lastIndexOf("Subscribe ");
    if (i >= 0) name = name.slice(i + "Subscribe ".length).trim();
    out.set(name, { usd: Number(m[2].replace(/,/g, "")), period: m[3] });
  }
  return out;
}

/** Что продаётся на Gumroad — из витрины сайта, там же лежат ссылки в кассу. */
function gumroadFromSite() {
  const file = resolve(REPO, "frontend/src/lib/products.ts");
  if (!existsSync(file)) return [];
  const src = readFileSync(file, "utf8");
  const rows = [];
  for (const m of src.matchAll(/\{[^{}]*processor:\s*"gumroad"[^{}]*\}/gs)) {
    const b = m[0];
    const id = /id:\s*"([^"]+)"/.exec(b)?.[1];
    const title = /title:\s*"([^"]+)"/.exec(b)?.[1];
    const price = /priceUsd:\s*([\d.]+)/.exec(b)?.[1];
    const billing = /billing:\s*"([^"]+)"/.exec(b)?.[1];
    if (id && title && price) rows.push({ id, title, usd: Number(price), billing: billing || "once" });
  }
  return rows;
}

/**
 * Сколько КАССА возьмёт на самом деле.
 *
 * ЗАЧЕМ отдельно от цен витрины. Всё, что карта знала о ценах, бралось из
 * НАШИХ же файлов: `products.ts`, `/api/pricing`. Это отвечает на вопрос
 * «согласованы ли наши источники между собой», но не на вопрос «спишет ли
 * касса ту сумму, которую мы обещали». Между ними целый Gumroad: там цену
 * правят руками в панели, и наш репозиторий об этом не узнаёт.
 *
 * Как узнаём. Ссылка `gumroad.com/l/<permalink>?wanted=true` перенаправляет на
 * оплату, и НАСТОЯЩАЯ цена лежит прямо в адресе перенаправления:
 * `...&price=5900&recurrence=monthly...`. Значит достаточно одного запроса на
 * товар, без единой копейки и без входа в аккаунт.
 *
 * Замер 28.08.2026: девять товаров из девяти сошлись — витрина обещает ровно
 * то, что спишет касса.
 *
 * Отказ считается ОТКАЗОМ, а не совпадением: `price: null` и в отчёте
 * «спросить не удалось». Молчаливое «сошлось» здесь было бы худшим из
 * возможных ответов.
 */
async function gumroadRealPrices(rows) {
  const out = [];
  for (const r of rows) {
    try {
      const res = await fetch(`https://aevion.gumroad.com/l/${encodeURIComponent(r.id)}?wanted=true`, {
        headers: { "User-Agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });
      const u = new URL(res.url);
      const cents = u.searchParams.get("price");
      const rec = u.searchParams.get("recurrence");
      out.push({
        id: r.id,
        title: r.title,
        siteUsd: r.usd,
        realUsd: cents === null ? null : Number(cents) / 100,
        recurrence: rec,
        billing: r.billing,
        http: res.status,
      });
    } catch (e) {
      out.push({ id: r.id, title: r.title, siteUsd: r.usd, realUsd: null, recurrence: null, billing: r.billing, why: String(e?.message ?? e).slice(0, 60) });
    }
  }
  return out;
}

/**
 * Какие кассы РЕАЛЬНО включены на проде.
 *
 * Карта отвечала «сколько стоит», но не отвечала «можно ли за это заплатить».
 * 18.08.2026 оказалось, что PayBox и PayPal не настроены вовсе, при том что
 * сайт обещал Kaspi, а страница интеграций показывала его как доступный.
 * Теперь состояние касс — часть карты, и берётся оно запросом, а не из памяти.
 */
/**
 * Что о выручке говорит САМА платформа.
 *
 * В карте выручка лежит в SALES_SNAPSHOT — числе, вписанном руками из панели
 * Gumroad, с датой замера. Это честно, но замер стареет: на 28.08.2026 ему
 * было две недели.
 *
 * У платформы есть свой счёт: `/api/revenue/summary`. Замер 28.08.2026 показал,
 * что источники РАСХОДЯТСЯ: снимок говорит 3 продажи на $29.97, ручка — 2 на
 * $19.98. Разница ровно в одну покупку $9.99, и рядом ручка сообщает про 2
 * ВНУТРЕННИЕ (проверочные) покупки, которые в выручку не входят. Похоже, в
 * ручной снимок попала одна из них.
 *
 * Разрешить спор может только панель Gumroad, то есть рука основателя. Пока
 * этого не произошло, карта показывает ОБА числа с их источниками: одно число
 * без второго читалось бы как истина.
 */
async function liveRevenue() {
  try {
    const j = await getJson(`${API}/api/revenue/summary`);
    return {
      grossUsd: Number(j.grossUsd ?? 0),
      saleCount: Number(j.saleCount ?? 0),
      internalUsd: Number(j.internalUsd ?? 0),
      internalCount: Number(j.internalCount ?? 0),
      // Ручка сама помечает неполный экспорт. Отсутствие метки — это «данные
      // полные», а не «мы не проверяли».
      degraded: Boolean(j.degraded ?? j.incomplete ?? false),
    };
  } catch (e) {
    // Отказ — это «не знаю», а не «ноль выручки».
    return null;
  }
}

async function cashDesks() {
  try {
    const j = await getJson(`${API}/api/pricing/checkout/healthz`);
    return { primary: j.primaryProvider || null, providers: j.providers || {} };
  } catch {
    return null; // «не спросили» — не то же, что «не работает»
  }
}

/**
 * Заявления о масштабе против фактов с прода.
 *
 * На /pricing висят «12 000+ зарегистрированных идей» и «3 200+
 * сертифицированных артефактов». Аудит 10.08.2026 записал прямо в
 * data/trust.ts: источник этих чисел в коде не найден, компания
 * pre-revenue, — и правильно не стал подставлять правдоподобное вместо
 * выдуманного. Тогда сравнить было не с чем.
 *
 * 18.08.2026 сравнить есть с чем: прод отдаёт настоящие счётчики. Разрыв
 * оказался не в процентах, а в сотнях раз. Поэтому сверка живёт здесь, в
 * ежедневной карте: заявление, которое расходится с фактом, должно попадаться
 * на глаза само, а не ждать следующего аудита.
 *
 * Решение, что делать с числами, — основателя (это позиционирование).
 * Задача карты — не дать забыть, что решение открыто.
 */
async function scaleClaims() {
  const [planet, qright, registry] = await Promise.all([
    getJson(`${API}/api/planet/stats`).catch(() => null),
    getJson(`${API}/api/qright/objects`).catch(() => null),
    getJson(`${API}/api/aevion/registry-stats`).catch(() => null),
  ]);
  if (!planet && !qright && !registry) return null;

  const objects = qright && typeof qright.total === "number" ? qright.total : null;
  const certified = planet ? planet.certifiedArtifactVersions ?? null : null;
  const modules = registry ? registry.total ?? null : null;

  return [
    { claim: "12 000+", what: "зарегистрированных идей", real: objects, src: "/api/qright/objects" },
    { claim: "3 200+", what: "сертифицированных артефактов", real: certified, src: "/api/planet/stats" },
    { claim: "40", what: "модулей платформы", real: modules === null ? null : modules - 1, src: "/api/aevion/registry-stats (минус globus)" },
    { claim: "30+", what: "стран использования", real: null, src: "источника нет" },
    { claim: "99.5%", what: "API uptime SLA", real: null, src: "в коде три разные лестницы" },
  ];
}

/**
 * Проверки САМОГО ПРОДА: не откатилось ли то, что уже чинили.
 *
 * 19.08.2026 за один день прод трижды сменил владельца: три сессии выкатывали
 * свои ветки в один сервис, каждая собранная от своей точки. Дважды это
 * отбрасывало уже сделанные правки, и оба раза обнаруживалось только потому,
 * что я спрашивал прод руками. Молча — потому что ничего не падает: сервер
 * жив, ручки отвечают 200, просто код старее.
 *
 * Поэтому две проверки живут здесь, в ежедневной карте, и спрашивают ПРОД, а не
 * репозиторий. Тесты стерегут код, а карта стережёт то, что реально работает.
 */
async function prodRegressions() {
  const out = [];

  // 1) Ошибка формы подписки на /go должна приходить по-русски.
  //    Пустое тело записи не создаёт — проверка безопасна.
  try {
    const res = await fetch(`${API}/api/constitution/waitlist/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
    const j = JSON.parse(new TextDecoder("utf-8").decode(await res.arrayBuffer()));
    const msg = j?.fields?.[0]?.message_ru ?? "";
    const ru = /[а-яё]/i.test(msg);
    out.push({
      what: "ошибка формы подписки — по-русски",
      ok: ru,
      detail: msg ? `«${msg.slice(0, 60)}»` : "поле message_ru пустое",
      why: "форма на /go — единственная ссылка из соцсетей",
    });
  } catch (e) {
    out.push({ what: "ошибка формы подписки — по-русски", ok: null, detail: `не спросили: ${e.message}`, why: "" });
  }

  // 2) Обещание доступности не выше опубликованного договора.
  try {
    const [trust, quotas] = await Promise.all([
      getJson(`${API}/api/pricing/trust`),
      getJson(`${API}/api/quotas`),
    ]);
    const max = Math.max(
      ...(quotas.tiers ?? []).map((t) => Number(t?.sla?.uptime) || 0),
    );
    const rows = trust.numbers ?? trust.trustNumbers ?? [];
    const sla = rows.find((r) => String(r.label).includes("SLA"));
    const claimed = String(`${sla?.value ?? ""} ${sla?.hint ?? ""}`)
      // Здесь стоял невидимый символ. 19.08.2026 регулярка была записана
      // через heredoc, где обозначение границы слова превратилось в настоящий
      // BACKSPACE (U+0008) внутри выражения: оно требовало в тексте символ
      // забоя и не совпадало никогда. Проверка честно отвечала «чисел нет» на
      // строке «99.5% … 99.95%», которую видно глазами.
      //
      // Тот же символ часом раньше сделал слепым сторожа во фронтенде — я снял
      // его, не найдя причины. Причина была эта. Регулярки правим редактором,
      // а не генерацией из другого языка.
      .match(/(9\d(?:\.\d+)?)%/g)
      ?.map((x) => Number(x.replace("%", ""))) ?? [];
    const over = claimed.filter((v) => v > max);
    out.push({
      what: "SLA на витрине не выше договора",
      // Пустой список чисел — это НЕ «всё в порядке». Так уже было 19.08:
      // витрина не отдала ни одного процента, и первая версия проверки
      // объявила это успехом. Отсутствие находки и отсутствие проблемы —
      // разные вещи; когда судить не по чему, честный ответ «не проверено».
      ok: max > 0 && claimed.length > 0 ? over.length === 0 : null,
      detail: max <= 0
        ? "договор не отдал ни одного uptime"
        : claimed.length === 0
          ? "на витрине не нашлось ни одного процента — судить не по чему"
          : `витрина: ${claimed.join(", ")} · договор: максимум ${max}%`,
      why: "обещать сверх контракта — обязательство, которого не брали",
    });
  } catch (e) {
    out.push({ what: "SLA на витрине не выше договора", ok: null, detail: `не спросили: ${e.message}`, why: "" });
  }

  return out;
}

/**
 * Что ждёт решения основателя — читается ИЗ СТОРОЖЕЙ, а не пишется руками.
 *
 * Блок «что противоречит» я написал 14.08 текстом и 19.08 нашёл в нём протухший
 * пункт: карта звала чинить расхождение цены QRenew, которое к тому времени
 * было сведено, а настоящая проблема стала другой. Документ, который правят
 * руками, расходится с делом ровно так же, как любой другой.
 *
 * Теперь список берётся из AWAITING_FOUNDER в тестах-сторожах. У них есть
 * проверка на протухание: как только расхождение уйдёт, тест потребует убрать
 * строку — и она исчезнет отсюда сама.
 */
function awaitingFounder() {
  const files = [
    "aevion-globus-backend/tests/priceLadderCoherence.test.ts",
    "aevion-globus-backend/tests/sameEntitlementSamePrice.test.ts",
    // Добавлен 19.08.2026: модули, у которых нет НИ ОДНОГО способа оплаты.
    // Замер того дня — 11 из 41, и нашлись они только тем, что я пересчитал
    // руками. Теперь список ведёт сторож и он же требует убрать строку,
    // как только цена появится.
    "aevion-globus-backend/tests/everyLiveModuleCanBeBought.test.ts",
  ];
  const out = [];
  for (const rel of files) {
    const abs = resolve(REPO, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, "utf8");
    // Закрывающая скобка бывает С ОТСТУПОМ: в одном файле список объявлен на
    // верхнем уровне, в другом — внутри describe. Шаблон, требовавший `};` в
    // начале строки, молча пропускал второй файл, и блок показывал один пункт
    // из трёх — то есть выглядел рабочим и врал недосказанностью.
    const block = /AWAITING_FOUNDER[^=]*=\s*\{([\s\S]*?)\n\s*\};/.exec(src)?.[1];
    if (!block) continue;
    // Записи вида `ключ:` или `"ключ":` с текстом причины из склеенных строк.
    for (const m of block.matchAll(/(?:^|\n)\s*"?([\w-]+)"?:\s*((?:"[^"]*"\s*\+?\s*)+),/g)) {
      const reason = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join("");
      out.push({ key: m[1], reason, from: rel.split("/").pop() });
    }
  }
  return out;
}

/** Ссылка магазина → id модуля, как это делает бэкенд. Своей таблицы не заводим. */
function storeNameToModule() {
  const src = readFileSync(resolve(REPO, "aevion-globus-backend/src/data/lemonSqueezyVariants.ts"), "utf8");
  const names = {};
  const nb = src.match(/STOREFRONT_NAME_TO_REFERENCE[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (nb) for (const m of nb[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) names[m[1]] = m[2];
  const slugs = {};
  const sb = src.match(/APP_SLUG_TO_MODULE_ID[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (sb) for (const m of sb[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) slugs[m[1]] = m[2];

  const out = new Map();
  for (const [name, ref] of Object.entries(names)) {
    if (!ref.startsWith("app_")) continue;
    const slug = ref.slice("app_".length);
    out.set(name, slugs[slug] || slug);
  }
  return out;
}

function row(cells) {
  return "          <tr>" + cells.join("") + "</tr>";
}

function main(data) {
  const { pricing, shop, gum, real, live, nameToModule, measuredAt, desks, claims, regressions, pending } = data;

  const tierPrice = new Map(pricing.tiers.map((t) => [t.id, t.priceMonthly]));

  // ── Блок А
  const tierRows = pricing.tiers.map((t) => {
    if (t.priceMonthly == null) {
      return row([`<th scope="row">${esc(TIER_RU[t.id] || t.id)}</th>`,
        `<td class="num">по запросу</td><td class="num">—</td><td class="num">—</td>`,
        `<td>${esc(t.tagline || "")}</td>`]);
    }
    if (t.priceMonthly === 0) {
      return row([`<th scope="row">${esc(TIER_RU[t.id] || t.id)}</th>`,
        `<td class="num">$0</td><td class="num">—</td><td class="num">—</td>`,
        `<td>${esc(t.tagline || "")}</td>`]);
    }
    const save = Math.round((1 - t.priceAnnualTotal / 12 / t.priceMonthly) * 100);
    return row([
      `<th scope="row">${esc(TIER_RU[t.id] || t.id)}</th>`,
      `<td class="num">$${t.priceMonthly}</td>`,
      `<td class="num">$${t.priceAnnualPerMonth}<span class="sub">$${t.priceAnnualTotal}/год</span></td>`,
      `<td class="num ${save > 0 ? "pos" : "bad"}">${save > 0 ? "−" : "+"}${Math.abs(save)}%</td>`,
      `<td>${esc(t.tagline || "")}</td>`,
    ]);
  });

  // ── Блок Б: цена в прайсе против цены в кассе
  const shopByModule = new Map();
  for (const [name, price] of shop) {
    const mod = nameToModule.get(name);
    if (mod) shopByModule.set(mod, price.usd);
  }
  let mismatches = 0;
  const modRows = pricing.modules
    .filter((m) => typeof m.addonMonthly === "number" && m.addonMonthly > 0)
    .sort((a, b) => b.addonMonthly - a.addonMonthly)
    .map((m) => {
      const cheapest = ["free", "lite", "medium", "full"]
        .filter((id) => (m.includedIn || []).includes(id))
        .map((id) => ({ id, price: tierPrice.get(id) }))
        .find((x) => typeof x.price === "number" && x.price > 0);
      const inc = cheapest ? `${TIER_RU[cheapest.id]} ($${cheapest.price})` : "только Предприятие";
      const dominated = cheapest && m.addonMonthly >= cheapest.price;

      const s = shopByModule.get(m.id);
      let shopCell;
      if (s === undefined) shopCell = '<span class="dim">не продаётся отдельно</span>';
      else if (Math.abs(s - m.addonMonthly) < 0.01) shopCell = `$${s}`;
      else { shopCell = `<span class="bad">$${s}</span>`; mismatches++; }

      return row([
        `<th scope="row">${esc(MODULE_RU[m.id] || m.id)}` +
          (dominated ? ' <span class="chip chip-bad">дороже тарифа с ним внутри</span>' : "") +
          `</th>`,
        `<td class="num">$${m.addonMonthly}</td>`,
        `<td class="num">${shopCell}</td>`,
        `<td>${esc(inc)}</td>`,
      ]);
    });

  // ── Блок В
  const modPrice = new Map(pricing.modules.map((m) => [m.id, m.addonMonthly]));
  const bundleRows = (pricing.bundles || []).map((b) => {
    const parts = b.modules.reduce((s, id) => s + (Number(modPrice.get(id)) || 0), 0);
    const names = b.modules.map((id) => MODULE_RU[id] || id).join(" · ");
    const real = parts > 0 ? Math.round((1 - b.priceMonthly / parts) * 100) : null;
    return row([
      `<th scope="row">${esc(b.name)}<span class="sub">${esc(names)}</span></th>`,
      `<td class="num">$${b.priceMonthly}</td>`,
      `<td class="num">$${parts.toFixed(2)}</td>`,
      `<td class="num ${real !== null && real > 0 ? "pos" : "bad"}">` +
        (real === null ? "—" : `${real > 0 ? "−" : "+"}${Math.abs(real)}%`) + `</td>`,
    ]);
  });

  // ── Блок Г
  let soldTotal = 0;
  let soldCount = 0;
  const gumRows = gum.map((g) => {
    const s = SALES_SNAPSHOT.bySlug[g.id];
    if (s) { soldTotal += s.usd; soldCount += s.count; }
    const kind = g.billing === "monthly" ? "подписка" : "разовая покупка";
    return row([
      `<th scope="row">${esc(g.title)}<span class="sub">${kind} · /${esc(g.id)}</span></th>`,
      `<td class="num">$${g.usd}${g.billing === "monthly" ? "/мес" : ""}</td>`,
      `<td class="num">${s ? `<span class="pos">${s.count}</span>` : '<span class="dim">0</span>'}</td>`,
      `<td class="num">${s ? `$${s.usd.toFixed(2)}` : '<span class="dim">$0</span>'}</td>`,
    ]);
  });

  // ── Блок Д
  const promoRows = (pricing.promos || []).map((p) => {
    const size = p.kind === "percent" ? `−${p.amount}%` : `до −$${p.amount}`;
    const scope = p.tiers && p.tiers.length ? p.tiers.join(", ") : "любой тариф";
    return row([
      `<th scope="row"><code>${esc(p.code)}</code></th>`,
      `<td class="num">${size}</td>`,
      `<td>${esc(scope)}</td>`,
      `<td>${esc(p.description || "")}</td>`,
    ]);
  });

  // ── Блок Ж: кассы
  const DESK_RU = {
    lemonsqueezy: ["Lemon Squeezy", "подписки и модули, карты мира"],
    gumroad: ["Gumroad", "книги и разовые товары"],
    paybox: ["PayBox", "карты Казахстана и Kaspi"],
    paypal: ["PayPal", "регионы без Stripe"],
  };
  let deskRows;
  if (!desks) {
    deskRows = row([`<td colspan="4"><span class="dim">Прод не ответил — состояние касс не проверено. Это НЕ «всё работает».</span></td>`]);
  } else {
    deskRows = Object.entries(DESK_RU).map(([id, [name, what]]) => {
      const p = desks.providers[id];
      const on = p && p.configured;
      const state = on
        ? '<span class="chip chip-ok">принимает</span>'
        : '<span class="chip chip-bad">не настроена</span>';
      const main = desks.primary === id ? '<span class="sub">основная</span>' : "";
      return row([
        `<th scope="row">${esc(name)}${main}</th>`,
        `<td>${esc(what)}</td>`,
        `<td>${esc((p && p.trigger) || "—")}</td>`,
        `<td>${state}</td>`,
      ]);
    }).join("\n");
  }

  // Сколько касс РЕАЛЬНО принимает. Было зашито «3», и 18.08.2026 это оказалось
  // неправдой: принимают две. Зашитое число на карте — та же болезнь, что и
  // зашитая версия в /health: выглядит ответом, а ответом не является.
  const deskAll = desks ? Object.keys(desks.providers).length : 0;
  const deskOn = desks ? Object.values(desks.providers).filter((p) => p && p.configured).length : 0;

  // ── Блок З: заявления против фактов
  let claimRows;
  if (!claims) {
    claimRows = row([`<td colspan="4"><span class="dim">Прод не ответил — заявления не сверены. Это НЕ «всё сходится».</span></td>`]);
  } else {
    claimRows = claims.map((c) => {
      let verdict;
      if (c.real === null) verdict = '<span class="chip chip-off">сверить не с чем</span>';
      else if (String(c.claim).replace(/[^\d]/g, "") === String(c.real)) verdict = '<span class="chip chip-ok">сходится</span>';
      else {
        const claimNum = Number(String(c.claim).replace(/[^\d]/g, ""));
        const times = c.real > 0 ? Math.round(claimNum / c.real) : null;
        verdict = `<span class="chip chip-bad">${times ? `больше в ${times} раз` : "расходится"}</span>`;
      }
      return row([
        `<th scope="row">${esc(c.claim)}<span class="sub">${esc(c.what)}</span></th>`,
        `<td class="num">${c.real === null ? '<span class="dim">—</span>' : esc(c.real)}</td>`,
        `<td><code>${esc(c.src)}</code></td>`,
        `<td>${verdict}</td>`,
      ]);
    }).join("\n");
  }

  // ── Блок И: не откатилось ли починенное
  const regRows = (regressions ?? []).map((r) => {
    const verdict = r.ok === null
      ? '<span class="chip chip-off">не проверено</span>'
      : r.ok
        ? '<span class="chip chip-ok">в порядке</span>'
        : '<span class="chip chip-bad">откатилось</span>';
    return row([
      `<th scope="row">${esc(r.what)}${r.why ? `<span class="sub">${esc(r.why)}</span>` : ""}</th>`,
      `<td>${esc(r.detail)}</td>`,
      `<td>${verdict}</td>`,
    ]);
  }).join("\n") || row([`<td colspan="3"><span class="dim">Прод не ответил — не проверено. Это НЕ «всё в порядке».</span></td>`]);

  // ── Блок Е: ждёт решения основателя (из сторожей)
  const pendingRows = (pending ?? []).length
    ? pending.map((x) => row([
        `<th scope="row">${esc(x.key)}<span class="sub">${esc(x.from)}</span></th>`,
        `<td>${esc(x.reason)}</td>`,
      ])).join("\n")
    : row([`<td colspan="2"><span class="dim">Список сторожей пуст — либо всё решено, либо файлы не прочитались.</span></td>`]);

  const totalProducts = shop.size + gum.length;

  const tpl = readFileSync(resolve(HERE, "money-map.tpl.html"), "utf8");
  const html = tpl
    .replace(/__MEASURED__/g, measuredAt)
    .replace(/__COMMIT__/g, esc(pricing.commit || "неизвестен"))
    .replace(/__NPRODUCTS__/g, String(totalProducts))
    .replace(/__NMODS__/g, String(modRows.length))
    .replace(/__EARNED__/g, `$${soldTotal.toFixed(2)}`)
    .replace(/__NSALES__/g, String(soldCount))
    .replace(/__SALES_AT__/g, SALES_SNAPSHOT.measuredAt)
    .replace(/__NMISMATCH__/g, String(mismatches))
    .replace("__TIERS__", tierRows.join("\n"))
    .replace("__MODS__", modRows.join("\n"))
    .replace("__BUNDLES__", bundleRows.join("\n"))
    .replace("__GUM__", gumRows.join("\n"))
    .replace("__PROMOS__", promoRows.join("\n"))
    .replace("__DESKS__", deskRows)
    .replace("__CLAIMS__", claimRows)
    .replace("__REGRESSIONS__", regRows)
    .replace("__PENDING__", pendingRows)
    .replace(/__NDESKS__/g, desks ? String(deskOn) : "?")
    .replace(/__NDESKS_ALL__/g, desks ? String(deskAll) : "?");

  const left = html.match(/__[A-Z_]+__/g);
  if (left) throw new Error(`в шаблоне остались подстановки: ${[...new Set(left)].join(", ")}`);

  writeFileSync(OUT, html, "utf8");
  console.log(`Карта собрана: ${OUT}`);
  console.log(`  товаров ${totalProducts} · модулей с ценой ${modRows.length} · расхождений цены ${mismatches}`);
  console.log(`  заработано ${soldTotal.toFixed(2)} за ${soldCount} продаж (ручной замер ${SALES_SNAPSHOT.measuredAt})`);
  // Второе число — от самой платформы. Показываем рядом, а не вместо: одно
  // без другого читается как истина, а они расходятся.
  if (live) {
    const diff = Math.abs(live.grossUsd - soldTotal) > 0.005 || live.saleCount !== soldCount;
    console.log(`  платформа считает: $${live.grossUsd.toFixed(2)} за ${live.saleCount} продаж` +
      (live.internalCount ? ` (плюс ${live.internalCount} внутренних на $${live.internalUsd.toFixed(2)}, в выручку не входят)` : "") +
      (live.degraded ? " · ⚠️ экспорт НЕПОЛНЫЙ" : "") +
      (diff ? " · 🔴 РАСХОДИТСЯ с ручным замером" : ""));
  } else {
    console.log("  платформа о выручке: спросить не удалось — это НЕ ноль");
  }
  // Отдельная строка про КАССУ. Три исхода, а не два: сошлось / разошлось /
  // спросить не удалось. Третий не сливаем с первым — молчаливое «сошлось»
  // про деньги хуже отсутствия проверки.
  if (Array.isArray(real) && real.length) {
    const asked = real.filter((r) => r.realUsd !== null);
    const bad = asked.filter((r) => Math.abs(r.realUsd - r.siteUsd) > 0.005);
    const mute = real.length - asked.length;
    console.log(`  касса берёт как обещано: ${asked.length - bad.length} из ${asked.length}` +
      (bad.length ? ` · РАСХОЖДЕНИЕ: ${bad.map((r) => `${r.id} витрина $${r.siteUsd} касса $${r.realUsd}`).join(", ")}` : "") +
      (mute ? ` · спросить не удалось: ${mute}` : ""));
  } else {
    console.log("  касса: НЕ СПРАШИВАЛИ — это не «сошлось»");
  }
}

try {
  const [pricing, shop] = await Promise.all([getJson(`${API}/api/pricing`), storefront()]);
  const gumRows = gumroadFromSite();
  let commit = null;
  try { commit = (await getJson(`${API}/api/health`)).commit; } catch { /* необязательно */ }
  if (!pricing.tiers?.length) throw new Error("прод не отдал тарифы — карта была бы пустой");
  if (!shop.size) throw new Error("витрина не отдала товаров — вероятно сменилась разметка");

  main({
    pricing: { ...pricing, commit },
    shop,
    gum: gumRows,
    real: await gumroadRealPrices(gumRows),
    nameToModule: storeNameToModule(),
    desks: await cashDesks(),
    live: await liveRevenue(),
    claims: await scaleClaims(),
    regressions: await prodRegressions(),
    pending: awaitingFounder(),
    measuredAt: new Date().toISOString().slice(0, 10),
  });
} catch (e) {
  // Старая карта лучше свежей неправды: не переписываем её наполовину.
  console.error(`Карта НЕ собрана: ${e.message}`);
  console.error("Прежний файл оставлен как был — половина правды хуже устаревшей целой.");
  process.exitCode = 2;
}
