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

/** Достаёт из каталога пары id -> ссылка кассы. Бросает, если разбор не удался. */
function readCatalog() {
  const src = fs.readFileSync(CATALOG, "utf8");
  const marks = [];
  const re = /id:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) marks.push([m[1], m.index]);
  if (marks.length === 0) throw new Error("в каталоге не найдено ни одного id");

  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const [id, start] = marks[i];
    // Границей служит СЛЕДУЮЩИЙ id, а не окно фиксированной длины: у карточек
    // бывают длинные комментарии, и срез в 900 символов однажды уже спрятал
    // от меня цену и ссылку, а выглядело это как «у товара их нет».
    const end = i + 1 < marks.length ? marks[i + 1][1] : src.length;
    const chunk = src.slice(start, end);
    const href = chunk.match(/href:\s*(LS|GR)\("([^"]+)"\)/);
    if (!href) continue;
    const price = (chunk.match(/priceUsd:\s*([0-9]+)/) || [])[1] ?? null;
    const url =
      href[1] === "LS"
        ? `https://aevion.lemonsqueezy.com/checkout/buy/${href[2]}`
        : `https://gumroad.com/l/${href[2]}`;
    out.push({ id, price, url });
  }
  return out;
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
  try {
    products = readCatalog();
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

  console.log("расхождений нет");
  // Неполный обход не выдаём за полный: если часть касс молчала, ответ
  // «чисто» относится только к тем, что ответили.
  process.exitCode = unreachable.length ? 2 : 0;
}

// process.exit() здесь НЕ звать: node на Windows роняет процесс ассертом
// libuv поверх незакрытых соединений undici и печатает успех с кодом 127.
await main();
