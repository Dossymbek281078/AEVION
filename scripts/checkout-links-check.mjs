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
 * 🔴 Замер 12.08.2026 «все 9 адресов Lemon Squeezy — 404» БЫЛ ЛОЖНЫМ. Товары
 * живые: настоящий браузер открывает страницу оплаты (AEVION Smeta Trainer,
 * 49,00 $, карта и PayPal). Красноту давала сама проверка — она ходила с
 * поддельным браузерным заголовком `Mozilla/5.0 (AEVION checkout-links-check)`,
 * а защита магазина от ботов отвечает на такие запросы кодом 404. Проверено
 * перебором: поддельный браузер → 404, честный агент → 404, `curl/8.7.1` → 200,
 * причём выдуманный товар даёт 404 при любом заголовке — то есть по коду
 * ответа «товара нет» и «нас не пустили» неразличимы в принципе.
 *
 * Отсюда устройство проверки: код ответа на отдельную кнопку — НЕ доказательство.
 * Источник правды — витрина магазина: она открывается честному агенту и сама
 * перечисляет все живые адреса `/checkout/buy/<uuid>`. Кнопка считается мёртвой,
 * только если её адреса нет в этом списке И прямой запрос подтверждает 404 при
 * рабочей калибровке. Во всех остальных случаях вывод «НЕ ПРОВЕРЕНО», а не
 * «мёртвая»: ложная тревога здесь дороже пропуска — она отправляет чинить
 * работающий приём денег.
 *
 * Запуск:  node scripts/checkout-links-check.mjs          — только код
 *          node scripts/checkout-links-check.mjs --prod   — код + живые страницы
 * Код выхода: 0 — все живы, 1 — есть мёртвые, 2 — проверить не удалось.
 *
 * Про --prod. Проверять один код НЕДОСТАТОЧНО: 12.08.2026 витрина
 * `aevion.app/shop` отдавала семь ссылок Lemon Squeezy, которых в репозитории
 * нет вовсе — прод не выкатывался с 27.07 и разошёлся с кодом. Проверка по
 * одному лишь коду занизила бы охват почти вдвое.
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

// Страницы, которые реально показывают кнопки покупки. Прод живёт отдельно от
// кода, поэтому список свой, а не выведенный из репозитория.
const PROD_PAGES = ["/shop", "/apps", "/studio", "/devhub", "/pricing", "/constitution/pricing"];
const PROD_BASE = process.env.PROD_BASE || "https://aevion.app";

if (process.argv.includes("--prod")) {
  console.log(`Смотрю живые страницы на ${PROD_BASE}…`);
  for (const page of PROD_PAGES) {
    try {
      const res = await fetch(`${PROD_BASE}${page}`, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (AEVION checkout-links-check)" },
        signal: AbortSignal.timeout(25_000),
      });
      const html = await res.text();
      let n = 0;
      for (const m of html.matchAll(URL_RE)) {
        const url = m[0];
        if (!found.has(url)) found.set(url, new Set());
        found.get(url).add(`прод ${page}`);
        n += 1;
      }
      console.log(`  ${page} — ${res.status}, ссылок на магазины: ${new Set([...html.matchAll(URL_RE)].map((x) => x[0])).size}`);
      void n;
    } catch (e) {
      console.log(`  ${page} — не открылась: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("");
}

if (found.size === 0) {
  console.log("Ссылок на магазины во фронтенде не нашлось — проверять нечего.");
  process.exit(0);
}

console.log(`Проверяю ${found.size} уникальных адресов…\n`);

// Честный агент: выдавать себя за браузер нельзя — именно из-за этого проверка
// и краснела впустую. Витрина магазина такому агенту отвечает нормально.
const UA = "AEVION-checkout-links-check/1.0 (+https://aevion.app)";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, timeout = 20_000) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeout),
  });
  return { code: res.status, body: await res.text() };
}

/**
 * Витрина магазина Lemon Squeezy перечисляет живые товары ссылками
 * `/checkout/buy/<uuid>`. Это независимый от кода ответа список того, что
 * реально можно купить, — им и судим.
 */
const storefronts = new Map(); // host -> Set(uuid) | null, если витрина не открылась
async function liveIdsOf(host) {
  if (storefronts.has(host)) return storefronts.get(host);
  let ids = null;
  try {
    const { code, body } = await get(`https://${host}/`);
    if (code >= 200 && code < 300) {
      ids = new Set([...body.matchAll(/checkout\/buy\/([a-f0-9-]{36})/g)].map((m) => m[1]));
      if (ids.size === 0) ids = null; // пустой список судьёй быть не может
    }
    console.log(`  витрина ${host} — ${code}, живых товаров в списке: ${ids ? ids.size : "не разобрать"}`);
  } catch (e) {
    console.log(`  витрина ${host} — не открылась: ${e.message}`);
  }
  storefronts.set(host, ids);
  await pause(1000);
  return ids;
}

/**
 * Калибровка прямого запроса. Нужна там, где товара нет в списке витрины:
 * он может быть скрыт из витрины, а может быть удалён. Верить коду ответа
 * можно, только если на заведомо живом адресе он даёт 2xx, а на выдуманном — 404.
 * Иначе прямой запрос не различает «нет товара» и «нас не пустили».
 */
const calibration = new Map(); // host -> boolean
async function canJudgeDirectly(host, knownLiveUrl) {
  if (calibration.has(host)) return calibration.get(host);
  let ok = false;
  try {
    const fakeUrl = knownLiveUrl.replace(/[a-f0-9]{8}(-[a-f0-9-]+)?$/, "00000000-0000-0000-0000-000000000000");
    const live = await get(knownLiveUrl);
    await pause(1000);
    const fake = await get(fakeUrl);
    ok = live.code >= 200 && live.code < 300 && fake.code === 404;
    console.log(`  калибровка ${host}: заведомо живой — ${live.code}, выдуманный — ${fake.code} → ${ok ? "коду ответа верим" : "коду ответа НЕ верим"}`);
  } catch (e) {
    console.log(`  калибровка ${host} не удалась: ${e.message}`);
  }
  calibration.set(host, ok);
  await pause(1000);
  return ok;
}

const dead = [];
const unknown = [];
for (const [url, files] of [...found].sort()) {
  const host = new URL(url).host;
  const uuid = url.match(/checkout\/buy\/([a-f0-9-]{36})/)?.[1];
  let state = null;
  let why = "";

  if (uuid) {
    const ids = await liveIdsOf(host);
    if (ids && ids.has(uuid)) {
      state = "ok";
      why = "есть в списке товаров витрины";
    } else if (!ids) {
      state = "unknown";
      why = "витрина магазина не отдала список товаров — судить не по чему";
    } else {
      // Нет в витрине: либо скрыт из списка, либо удалён. Различаем прямым
      // запросом, и только если калибровка показала, что коду ответа можно верить.
      const [anyLive] = [...ids];
      const judgeable = await canJudgeDirectly(host, `https://${host}/checkout/buy/${anyLive}`);
      if (!judgeable) {
        state = "unknown";
        why = "нет в списке товаров витрины — похоже, снят с продажи; но прямой запрос режет защита магазина, так что подтвердить нечем. ОТКРОЙТЕ АДРЕС В БРАУЗЕРЕ.";
      } else {
        try {
          const { code } = await get(url);
          if (code >= 200 && code < 300) {
            state = "ok";
            why = "скрыт из витрины, но страница оплаты открывается";
          } else {
            state = "dead";
            why = `нет в витрине магазина, прямой запрос — ${code}`;
          }
        } catch (e) {
          state = "unknown";
          why = `сеть: ${e.message}`;
        }
      }
    }
  } else {
    // Gumroad и прочие: там прямой запрос работает. Но проверяем то же самое —
    // различает ли код ответа живое и выдуманное.
    const probeBase = url.replace(/\/l\/[a-zA-Z0-9]+$/, "/l/zzzznotexisting");
    let judgeable = calibration.get(host);
    if (judgeable === undefined) {
      try {
        const fake = await get(probeBase);
        judgeable = fake.code === 404;
        console.log(`  калибровка ${host}: выдуманный товар — ${fake.code} → ${judgeable ? "коду ответа верим" : "коду ответа НЕ верим"}`);
      } catch {
        judgeable = false;
      }
      calibration.set(host, judgeable);
      await pause(1000);
    }
    try {
      const { code } = await get(url);
      if (code >= 200 && code < 300) {
        state = "ok";
        why = `страница открывается (${code})`;
      } else if (judgeable) {
        state = "dead";
        why = `страница отвечает ${code}, выдуманный товар — тоже 404: код различает`;
      } else {
        state = "unknown";
        why = `ответ ${code}, но выдуманный товар отвечает так же — код ничего не доказывает`;
      }
    } catch (e) {
      state = "unknown";
      why = `сеть: ${e.message}`;
    }
  }

  const label = { ok: "OK   ", dead: "МЁРТВ", unknown: "НЕ ПРОВЕРЕНО" }[state];
  console.log(`  ${label}  ${url}\n         ${why}`);
  if (state === "dead") {
    dead.push({ url, files: [...files], why });
    for (const f of files) console.log(`         ← ${f}`);
  }
  if (state === "unknown") unknown.push({ url, why });
  await pause(1000); // не долбим витрину
}

console.log("");
if (dead.length === 0 && unknown.length === 0) {
  console.log(`Все ${found.size} кнопок покупки ведут на живые товары.`);
  process.exit(0);
}

if (dead.length > 0) {
  console.log(`МЁРТВЫХ КНОПОК ПОКУПКИ: ${dead.length} из ${found.size}`);
  console.log("Покупатель, нажавший такую кнопку, попадает на 404 — продажа теряется без следа.");
}
if (unknown.length > 0) {
  console.log(`НЕ УДАЛОСЬ ПРОВЕРИТЬ: ${unknown.length} из ${found.size}.`);
  console.log("Это НЕ значит «мёртвые». Проверьте вручную в браузере, прежде чем что-то чинить.");
}
process.exit(dead.length > 0 ? 1 : 2);
