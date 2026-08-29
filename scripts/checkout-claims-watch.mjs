#!/usr/bin/env node
/**
 * Сторож ТРЕТЬЕГО текста — описаний товаров в кассе.
 *
 * Зачем. У обещания три места жизни, а проверялись до сих пор два:
 *
 *   1. код              — тесты
 *   2. наша страница    — catalogClaims.guard.test.ts
 *   3. описание в КАССЕ — не проверялось ничем
 *
 * Третий текст не лежит в репозитории, не появляется в дифе и не виден ни
 * одному сторожу — а читают его в ту секунду, когда вводят карту. 27.08.2026
 * так нашлись два расхождения на живых кассах: бюро продавало «Ed25519 +
 * OpenTimestamps» (якорения в бюро нет), qpaynet — «virtual cards» (у модуля
 * нет ни одного маршрута карт, они в соседнем товаре).
 *
 * Что делает: берёт ссылки касс из каталога, читает у каждой og:title и
 * og:description, сверяет с базовой линией и с коротким списком слов,
 * которые каталогу называть запрещено.
 *
 * Коды выхода — три, а не два (см. правило «неотвеченный вопрос не равен
 * благополучию»):
 *
 *   0 — сверка прошла, расхождений нет
 *   1 — есть расхождения, читайте вывод
 *   2 — сверку выполнить НЕ УДАЛОСЬ (сеть, разбор каталога). Это не «чисто».
 *
 * ⚠️ Как проверять этого сторожа мутацией. Код выхода для этого НЕ годится,
 * если находка уже записана в известные: снимешь проверку — известная строка
 * просто исчезнет, а код останется 0, и мутация скажет «не поймана». Проверять
 * надо ДО записи базы (тогда находка новая и даёт код 1) либо по ТЕКСТУ вывода.
 * Наступил на это 28.08.2026 сразу после того, как сам же добавил «известные».
 *
 * Запуск:
 *   node scripts/checkout-claims-watch.mjs            сверить с базовой линией
 *   node scripts/checkout-claims-watch.mjs --update   принять текущее как базу
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "frontend", "src", "lib", "products.ts");
const BASELINE = path.join(ROOT, "scripts", "checkout-claims.baseline.json");
const UPDATE = process.argv.includes("--update");

/**
 * Слова, которых в описании товара быть не должно, и ПОЧЕМУ.
 *
 * Список сознательно короткий и привязан к КОНКРЕТНОМУ товару, а не к
 * платформе. Три раза за 27.08 запрет «на слово вообще» оказывался шире
 * правды и требовал снять с витрины работающую возможность — один раз даже
 * из текста договора. Поэтому ключ здесь — id товара, и ничей чужой текст
 * этой проверкой не задевается.
 */
const FORBIDDEN = {
  bureau: [
    {
      word: "OpenTimestamps",
      why: "в bureau.ts якорения нет: два вхождения слова anchor — это text-anchor в SVG. Якорение живёт в pipeline (QRight), это другой товар",
    },
  ],
  qpaynet: [
    {
      word: "virtual card",
      why: "у qpaynet нет ни одного маршрута карт (wallets/deposit/withdraw/transfer/merchant); карты-маски живут в qmaskcard",
    },
  ],
};

/**
 * Кассы, которых НЕТ в каталоге товаров.
 *
 * Первая версия сторожа читала только `products.ts` и рапортовала «проверено
 * касс: 7 из 7» — знаменатель был её собственным, а не настоящим. Обход
 * фронтенда 28.08.2026 нашёл ещё семь живых касс: четыре на Gumroad
 * (два языка «Анти-седины», Constitution Pro и Team) и три варианта Lemon
 * Squeezy (Planet Monthly, Planet Annual, отдельный Smeta).
 *
 * То есть половина денежных страниц не проверялась, а отчёт выглядел полным.
 * Это тот же дефект, что «свип без знаменателя»: 7 из 7 звучит исчерпывающе.
 */
function scanFrontendCheckouts() {
  const base = path.join(ROOT, "frontend", "src");
  if (!fs.existsSync(base)) return [];
  const found = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "__tests__") continue;
        walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      const src = fs.readFileSync(p, "utf8");
      // Ссылки с подстановкой (${...}) пропускаем: это шаблон, а не адрес.
      const re =
        /https:\/\/aevion\.(?:gumroad\.com\/l\/([a-z0-9]+)|lemonsqueezy\.com\/checkout\/buy\/([0-9a-f-]{36}))/g;
      let m;
      while ((m = re.exec(src))) {
        const url = m[0];
        if (!found.has(url)) found.set(url, m[1] ? `gumroad:${m[1]}` : `ls:${m[2].slice(0, 8)}`);
      }
    }
  };
  walk(base);
  return [...found].map(([url, id]) => ({ id, price: null, url }));
}

/**
 * Как каталог строит адрес кассы. Держать в согласии с `products.ts`.
 *
 * ⚠️ 28.08.2026, найдено вычиткой собственного кода. Здесь стояло `(LS|GR)`,
 * а каталог использует `GUM(` — то есть девять товаров Gumroad из девяти
 * парсер не видел ВООБЩЕ, и сторож бодро печатал «13 из 13». Второй раз за
 * сутки один и тот же дефект: знаменатель, придуманный самим инструментом.
 *
 * Поэтому рядом заведён учёт НЕРАЗОБРАННЫХ товаров: молчать о том, чего не
 * понял, инструмент больше не может.
 */
const URL_BUILDERS = {
  LS: (id) => `https://aevion.lemonsqueezy.com/checkout/buy/${id}`,
  // БЕЗ `?wanted=true`, хотя каталог его добавляет. Замер: с этим параметром
  // Gumroad отдаёт страницу оверлея, у которой og:title — просто «Gumroad», а
  // описания нет вовсе. Девять товаров из девяти пришли пустыми и выглядели
  // как «нечего проверять». Нам нужна карточка товара, а не витрина покупки;
  // товар за ссылкой тот же самый.
  GUM: (permalink) => `https://aevion.gumroad.com/l/${permalink}`,
};

/**
 * Ключ товара — провайдер плюс идентификатор, а НЕ строка адреса.
 *
 * Один и тот же товар приезжает двумя путями: из каталога (`GUM("pyiaz")`) и
 * сплошным поиском по фронтенду (там адрес записан целиком, иногда с
 * `?wanted=true` или `?channel=tt`). По строке они разные, по сути одно и то
 * же — и в первом прогоне четыре товара посчитались дважды, а «22 кассы»
 * означало 18 настоящих.
 */
/**
 * Сколько живых модулей в реестре. 0 означает «спросить не удалось» — тогда
 * сверка чисел просто не проводится, а не считается пройденной.
 *
 * Читаем тот же файл, что и бэкенд (`data/projects.ts`), а не отдельный
 * список: второй источник истины про количество модулей — ровно то, из-за
 * чего письмо четыре месяца обещало «27».
 */
function countLiveModules() {
  try {
    const p = path.join(ROOT, "aevion-globus-backend", "src", "data", "projects.ts");
    if (!fs.existsSync(p)) return 0;
    const src = fs.readFileSync(p, "utf8");
    return (src.match(/status:\s*"live"/g) ?? []).length;
  } catch {
    return 0;
  }
}

function checkoutKey(url) {
  const gum = url.match(/gumroad\.com\/l\/([a-z0-9]+)/i);
  if (gum) return `gumroad:${gum[1].toLowerCase()}`;
  const ls = url.match(/checkout\/buy\/([0-9a-f-]{36})/i);
  if (ls) return `ls:${ls[1].toLowerCase()}`;
  return `url:${url}`;
}

/** Достаёт из каталога пары id -> ссылка кассы. Бросает, если разбор не удался. */
function readCatalog() {
  const src = fs.readFileSync(CATALOG, "utf8");
  const marks = [];
  const re = /id:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) marks.push([m[1], m.index]);
  if (marks.length === 0) throw new Error("в каталоге не найдено ни одного id");

  const out = [];
  const unparsed = [];
  for (let i = 0; i < marks.length; i++) {
    const [id, start] = marks[i];
    // Границей служит СЛЕДУЮЩИЙ id, а не окно фиксированной длины: у карточек
    // бывают длинные комментарии, и срез в 900 символов однажды уже спрятал
    // от меня цену и ссылку, а выглядело это как «у товара их нет».
    const end = i + 1 < marks.length ? marks[i + 1][1] : src.length;
    const chunk = src.slice(start, end);
    const href = chunk.match(/href:\s*([A-Za-z_]+)\("([^"]+)"\)/);
    if (!href) {
      // Две разные ситуации, и обе нельзя пропускать молча.
      if (/href:/.test(chunk)) {
        // Форма ссылки парсеру незнакома — именно так сторож и начинает
        // проверять половину, не сообщая об этом.
        unparsed.push(id);
      } else if (/priceUsd:\s*[0-9]+/.test(chunk)) {
        // У товара есть ЦЕНА, но нет ссылки на кассу вовсе. Это не «нечего
        // проверять», это «товар продаётся, а купить негде» — находка сама
        // по себе, и заметить её больше некому.
        unparsed.push(`${id} (есть цена, НЕТ ссылки на кассу)`);
      }
      continue;
    }
    const price = (chunk.match(/priceUsd:\s*([0-9]+)/) || [])[1] ?? null;
    const url = URL_BUILDERS[href[1]]?.(href[2]);
    if (!url) {
      // Помощник есть, но парсеру неизвестен. Это НЕ «у товара нет кассы».
      unparsed.push(`${id} (href: ${href[1]})`);
      continue;
    }
    out.push({ id, price, url });
  }
  return { products: out, unparsed };
}

const decode = (s) =>
  s
    .replace(/&amp;amp;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

/**
 * Читает описание кассы. Возвращает null, если ответ НЕ похож на страницу
 * кассы — короткий ответ это почти всегда редирект или заглушка, и принять
 * его за «описания нет» значит соврать в успокаивающую сторону.
 */
async function fetchClaims(url) {
  const res = await fetch(url, {
    redirect: "follow",
    // User-Agent здесь ЗНАЧИМ, и это не косметика. Замер 28.08.2026 на живой
    // кассе: curl/8.7.1 -> 200, своё имя инструмента -> 404, "node" -> 404,
    // без заголовка -> 404. То есть незнакомому агенту магазин отвечает
    // «страницы нет», и ссылка выглядит мёртвой, будучи живой.
    //
    // На этом уже обжигались: однажды девять кнопок «купить» объявили
    // сломанными, и находка оказалась ложной тревогой от User-Agent.
    // Поэтому здесь честный curl, а массовый 404 ниже трактуется как отказ
    // инструмента, а не как семь мёртвых касс.
    headers: { "user-agent": "curl/8.7.1" },
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const html = await res.text();
  if (html.length < 5000) {
    return { error: `ответ ${html.length} Б — это не страница кассы` };
  }
  const grab = (prop) => {
    const m = html.match(new RegExp(`og:${prop}" content="([^"]{0,400})`));
    return m ? decode(m[1]) : null;
  };
  const title = grab("title");
  const description = grab("description");
  if (!title && !description) return { error: "og-разметки нет в ответе" };
  return { title, description };
}

/**
 * Отпечаток находки для сравнения с известными. Берём ПЕРВУЮ строку: она
 * содержит товар и суть, но не содержит самого текста описания, который
 * может слегка меняться (пунктуация, регистр) без смены смысла.
 */
function fingerprint(finding) {
  return String(finding).split(String.fromCharCode(10))[0].trim();
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return { missing: true, items: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    // Старый формат — это сразу карта товаров; новый несёт items + known.
    const items = raw.items ?? raw;
    const known = Array.isArray(raw.known) ? raw.known : [];
    return { missing: false, items, known };
  } catch (e) {
    // Три исхода, а не два: битый файл это НЕ «базы нет» и НЕ «всё совпало».
    return { broken: String(e.message), items: null };
  }
}

async function main() {
  let products;
  let unparsedProducts = [];
  try {
    const parsed = readCatalog();
    products = parsed.products;
    unparsedProducts = parsed.unparsed;
    // Дополняем кассами вне каталога. Сверяем по ТОВАРУ, а не по строке
    // адреса: тот же продукт приезжает и из каталога, и из сплошного поиска,
    // и по строке они разные (`?wanted=true`, `?channel=tt`).
    const seen = new Set(products.map((p) => checkoutKey(p.url)));
    for (const extra of scanFrontendCheckouts()) {
      const key = checkoutKey(extra.url);
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(extra);
    }
  } catch (e) {
    console.log(`СВЕРКА НЕ ВЫПОЛНЕНА: каталог не разобран — ${e.message}`);
    process.exitCode = 2;
    return;
  }
  if (products.length === 0) {
    console.log("СВЕРКА НЕ ВЫПОЛНЕНА: в каталоге нет ни одной ссылки кассы");
    process.exitCode = 2;
    return;
  }

  const base = loadBaseline();
  if (base.broken) {
    console.log(`СВЕРКА НЕ ВЫПОЛНЕНА: базовая линия не читается — ${base.broken}`);
    process.exitCode = 2;
    return;
  }

  const now = {};
  const findings = [];
  const unreachable = [];

  for (const p of products) {
    const got = await fetchClaims(p.url);
    if (got.error) {
      unreachable.push(`${p.id}: ${got.error}`);
      continue;
    }
    now[p.id] = { title: got.title, description: got.description, price: p.price };

    const text = `${got.title ?? ""} ${got.description ?? ""}`.toLowerCase();
    for (const rule of FORBIDDEN[p.id] ?? []) {
      if (text.includes(rule.word.toLowerCase())) {
        findings.push(
          `[${p.id}] касса обещает «${rule.word}»\n      ${rule.why}\n      текст: ${got.description}`,
        );
      }
    }

    const was = base.items?.[p.id];
    if (was && was.description !== got.description) {
      findings.push(
        `[${p.id}] описание в кассе ИЗМЕНИЛОСЬ\n      было:  ${was.description}\n      стало: ${got.description}`,
      );
    }
    if (was && was.title !== got.title) {
      findings.push(`[${p.id}] название товара: «${was.title}» -> «${got.title}»`);
    }
  }

  // Ни один запрос не прошёл — это отказ сети, а не чистый результат.
  if (Object.keys(now).length === 0) {
    console.log("СВЕРКА НЕ ВЫПОЛНЕНА: ни одна касса не ответила");
    for (const u of unreachable) console.log(`  ${u}`);
    // Семь мёртвых касс разом — событие несравнимо более редкое, чем один
    // сломанный измеритель. Поэтому подсказка идёт сразу, чтобы следующий
    // читатель не пошёл чинить кассы.
    if (unreachable.every((u) => u.includes("404"))) {
      console.log(
        "\n  Все ответы 404. Почти наверняка дело в User-Agent, а не в кассах:\n" +
          "  магазин отвечает 404 незнакомому агенту. Проверьте одной командой:\n" +
          "    curl -s -L -o /dev/null -w '%{http_code}' -A 'curl/8.7.1' <ссылка кассы>",
      );
    }
    process.exitCode = 2;
    return;
  }

  // Число модулей, названное в кассе, сверяется с реестром.
  //
  // 28.08.2026 карточка AEVION All-Access обещала «all 15+ modules», когда в
  // `projects.ts` было 36 живых. Формально это не ложь — 36 больше 15, — но
  // покупателю верхнего тарифа продукт представлен вдвое меньшим, чем он
  // есть. Занижение никто не ловит: на завышенное обещание приходит жалоба,
  // на заниженное — тишина. Тот же дефект был в письме после оплаты («все 27
  // модулей») и в карточке CyberChess (молчала о турнирах).
  //
  // Сравниваем не «точно ли равно», а порядок: занижение более чем вдвое или
  // любое завышение — находка. Иначе сторож краснел бы от каждой округлённой
  // формулировки.
  const liveModules = countLiveModules();
  if (liveModules > 0) {
    for (const [id, v] of Object.entries(now)) {
      const text = `${v.title ?? ""} ${v.description ?? ""}`;
      const m = text.match(/(\d{1,3})\s*\+?\s*(?:modules|модул)/i);
      if (!m) continue;
      const claimed = Number(m[1]);
      if (!Number.isFinite(claimed) || claimed <= 0) continue;
      if (claimed > liveModules) {
        findings.push(
          `[${id}] в кассе обещано модулей БОЛЬШЕ, чем есть\n` +
            `      названо ${claimed}, в реестре живых ${liveModules}\n` +
            `      текст: ${text.trim().slice(0, 140)}`,
        );
      } else if (claimed * 2 < liveModules) {
        findings.push(
          `[${id}] в кассе продукт занижен более чем вдвое\n` +
            `      названо ${claimed}, в реестре живых ${liveModules}\n` +
            `      текст: ${text.trim().slice(0, 140)}`,
        );
      }
    }
  }

  // Два РАЗНЫХ товара с дословно одинаковым описанием — почти всегда недосмотр,
  // и он бьёт по деньгам: 28.08.2026 так нашлись Constitution Pro и
  // Constitution Team с одним и тем же текстом «unlimited saves, AI advisor,
  // clean PDF, embed widget». Покупатель в момент выбора между тарифами не
  // видит НИКАКОЙ разницы, а платит разное.
  const byDescription = new Map();
  for (const [id, v] of Object.entries(now)) {
    if (!v.description) continue;
    const key = v.description.trim();
    if (!byDescription.has(key)) byDescription.set(key, []);
    byDescription.get(key).push(id);
  }
  for (const [desc, ids] of byDescription) {
    if (ids.length < 2) continue;
    findings.push(
      `[${ids.join(" = ")}] разные товары, ОДНО описание\n` +
        `      покупатель не видит, чем они отличаются, а цены разные\n` +
        `      текст: ${desc.slice(0, 140)}`,
    );
  }


  if (UPDATE) {
    // В базу кладём и СПИСОК ИЗВЕСТНЫХ находок. Иначе сторож останется
    // красным каждый день до тех пор, пока описания не поправят в панели —
    // а это решение основателя, оно может ждать неделями. Ежедневно красная
    // проверка перестаёт читаться, и настоящая новая находка тонет в ней.
    // Известное показывается строкой «ждут решения», новое — тревогой.
    const payload = { items: now, known: findings.map(fingerprint) };
    fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + "\n");
    console.log(`базовая линия принята: ${Object.keys(now).length} касс`);
    if (findings.length) {
      console.log(`  известных расхождений записано: ${findings.length}`);
    }
    if (unreachable.length) {
      console.log(`  не ответили (в базу НЕ попали): ${unreachable.join("; ")}`);
    }
    process.exitCode = 0;
    return;
  }

  console.log(`проверено касс: ${Object.keys(now).length} из ${products.length}`);
  if (unparsedProducts.length) {
    // Знаменатель, о котором инструмент знает, что не знает. Печатается ВСЕГДА
    // и делает результат неполным: «проверено N из N» при непонятых товарах —
    // ровно то враньё, ради которого этот учёт и заведён.
    console.log(
      `НЕ РАЗОБРАНЫ (форма href незнакома, касса НЕ проверялась): ${unparsedProducts.join(", ")}`,
    );
  }
  if (base.missing) {
    console.log("базовой линии нет — первый запуск. Принять: --update");
  }
  if (unreachable.length) {
    console.log(`НЕ ОТВЕТИЛИ (это не «чисто»): ${unreachable.join("; ")}`);
  }

  // Известное отделяем от нового. Описания правятся в панели поставщика —
  // это решение основателя и оно может ждать неделями. Если каждый день
  // кричать одно и то же, проверку перестанут читать, и настоящая новая
  // находка утонет в привычной красноте.
  const known = new Set(base.known ?? []);
  const fresh = findings.filter((f) => !known.has(fingerprint(f)));
  const stale = findings.filter((f) => known.has(fingerprint(f)));

  if (stale.length) {
    console.log(`\nЖДУТ РЕШЕНИЯ (известны, не тревога): ${stale.length}`);
    for (const f of stale) console.log(`  · ${fingerprint(f)}`);
  }

  if (fresh.length) {
    console.log(`\nНОВЫХ РАСХОЖДЕНИЙ: ${fresh.length}\n`);
    for (const f of fresh) console.log(`  ${f}\n`);
    process.exitCode = 1;
    return;
  }

  // Итоговая строка обязана нести ВЕС, а не только отсутствие нового.
  //
  // Было просто «расхождений нет» — и стояло это ПОД списком из четырёх
  // известных находок. Последняя строка читается как вывод, поэтому
  // получалось «чистый лист» при четырёх нерешённых обещаниях в кассах.
  // Тот же класс, что «0 расхождений на 0 ручках»: отсутствие НОВОГО выдаётся
  // за отсутствие проблем.
  console.log(
    stale.length
      ? `нового нет; ЖДУТ РЕШЕНИЯ: ${stale.length} (см. выше — они никуда не делись)`
      : "расхождений нет, ждущих решения тоже нет",
  );
  // Неполный обход не выдаём за полный. Две причины неполноты, и обе дают
  // код 2 «проверить НЕ УДАЛОСЬ», а не 0:
  //   * касса не ответила;
  //   * товар не разобран — форма ссылки незнакома ИЛИ у товара есть цена,
  //     но ссылки на кассу нет вовсе («продаётся, а купить негде»).
  // Первое временно, второе постоянно, но «чисто» не значит ни то ни другое.
  process.exitCode = unreachable.length || unparsedProducts.length ? 2 : 0;
}

// process.exit() здесь НЕ звать: node на Windows роняет процесс ассертом
// libuv поверх незакрытых соединений undici и печатает успех с кодом 127.
await main();
