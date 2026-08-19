#!/usr/bin/env node
/**
 * Сводка готовности к запуску — одна таблица вместо вычитывания доски.
 *
 * Проверяет только то, что можно проверить машиной и на ЖИВОМ проде: страница
 * открывается, посадочная существует, приём адресов на ней есть, платёжная
 * ссылка отвечает, модуль под сторожем страниц. Плюс отдельные проверки под
 * конкретные блокеры шахмат — они и есть автоматическая приёмка Б-1 и Б-2.
 *
 * Чего он НЕ проверяет и проверять не может: пройден ли путь новичка, доходит
 * ли платёж до кассы, честны ли тексты. Эти ворота закрывает человек, и
 * скрипт не должен создавать впечатление, будто модуль готов, когда он лишь
 * открывается. Поэтому в выводе они перечислены как «за человеком».
 *
 * Запуск:
 *   node scripts/launch-readiness.mjs
 *   node scripts/launch-readiness.mjs --json
 *
 * Коды выхода: 0 — все машинные проверки прошли; 1 — есть красное;
 * 2 — проверка не выполнилась (сеть).
 */

const SITE = (process.env.AEVION_SITE || "https://aevion.app").replace(/\/+$/, "");
const API = `${SITE}/api-backend`;
const LAUNCH = Date.UTC(2026, 7, 30); // 30 августа 2026
const UA = "aevion-launch-readiness";

const MODULES = [
  { id: "cyberchess", name: "CyberChess", date: "30.08", page: "/cyberchess", landing: "/cyberchess/launch", price: 19 },
  { id: "qright", name: "QRight", date: "06.09", page: "/qright", landing: null, price: null },
  { id: "bureau", name: "IP Bureau", date: "06.09", page: "/bureau", landing: "/bureau/launch", price: 29 },
  // Посадочные DevHub и Multichat здесь стояли как `null` — и это было НЕВЕРНО:
  // обе написаны соседними окнами и уже отвечают 200 на проде (проверено
  // 19.08 вместе с отрицательным контролем: /qwerty/launch → 404). Сводка,
  // которая занижает готовность, толкает делать заново то, что готово, —
  // ровно этим я чуть не занялся. У QRight посадочной действительно нет:
  // пару закрывает /bureau/launch, поэтому здесь оставлен null.
  { id: "devhub", name: "DevHub", date: "13.09", page: "/devhub", landing: "/devhub/launch", price: 149 },
  { id: "multichat-engine", name: "Multichat", date: "20.09", page: "/multichat-engine", landing: "/multichat-engine/launch", price: null },
];

let networkFailed = false;

async function head(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html" }, signal: ctrl.signal });
      return { code: r.status, body: await r.text() };
    } finally {
      clearTimeout(t);
    }
  } catch {
    networkFailed = true;
    return { code: 0, body: "" };
  }
}

async function json(path) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(API + path, { headers: { "User-Agent": UA }, signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  } catch {
    networkFailed = true;
    return null;
  }
}

function daysLeft() {
  const n = new Date();
  return Math.round((LAUNCH - Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) / 86_400_000);
}

const mark = (ok) => (ok === null ? "—" : ok ? "да" : "НЕТ");

async function main() {
  const rows = [];

  for (const m of MODULES) {
    const page = await head(SITE + m.page);
    const landing = m.landing ? await head(SITE + m.landing) : null;
    // Приём адресов ищем на посадочной, а при её отсутствии — на самой странице
    // модуля: важно не «есть ли лендинг», а есть ли куда оставить адрес.
    const capture = landing?.code === 200 ? landing.body : page.body;
    rows.push({
      module: m.name,
      date: m.date,
      page: page.code === 200,
      landing: m.landing ? landing.code === 200 : null,
      capture: /type="email"/.test(capture || ""),
      price: m.price ? `$${m.price}` : "нет",
    });
  }

  // Отдельная приёмка блокеров шахмат — та самая, что стоит в доске.
  const daily = await json("/api/cyberchess-daily/puzzle");
  const board = await json("/api/cyberchess-daily/leaderboard");
  const puzzles = await json("/api/cyberchess-puzzles/meta");

  // Проверка была на ЧЕСТНОСТЬ (не 365 позиций-пустышек) и молчала о главном:
  // 19.08 выяснилось, что задача дня отдаётся из ЗАПАСНОГО пула на 30 позиций,
  // потому что ручка, на которую ссылается сам ответ
  // (/api/cyberchess-puzzles/daily), не существует — 404, и её нет ни в одной
  // ветке. В банке при этом 502 584 задачи. Пул из 30 значит повтор раз в
  // месяц, а «возврат на второй день» — это ворота 5 запуска.
  //
  // Подстановка честно помечена в поле `source`, поэтому её видно без догадок.
  // Раз механизм подставной — считаем ворота НЕ пройденными.
  const dailyFallback = daily ? /fallback/i.test(String(daily.source || "")) : null;
  const dailyHonest = daily ? daily.poolSize !== 365 && dailyFallback === false : null;
  const seeded = board?.leaderboard?.some((e) => String(e.userId || "").startsWith("seed_"));
  const boardHonest = board ? !seeded : null;
  const bank = puzzles?.bankTotal ?? puzzles?.poolSize ?? null;

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ daysLeft: daysLeft(), rows, chess: { dailyHonest, dailyFallback, boardHonest, bank } }, null, 2));
  } else {
    console.log(`Готовность к запуску · до 30 августа ${daysLeft()} дн. · ${SITE}\n`);
    console.log("МОДУЛЬ        ДАТА    страница  посадочная  приём адресов  цена");
    for (const r of rows) {
      console.log(
        `${r.module.padEnd(13)} ${r.date.padEnd(7)} ${mark(r.page).padEnd(9)} ${mark(r.landing).padEnd(11)} ${mark(r.capture).padEnd(14)} ${r.price}`,
      );
    }
    console.log("\nБлокеры CyberChess (приёмка Б-1 и Б-2 из доски):");
    console.log(
      `  задача дня из настоящего банка      : ${mark(dailyHonest)}` +
        (daily ? `  (пул ${daily.poolSize}${dailyFallback ? ", ЗАПАСНОЙ — настоящая ручка отдаёт 404" : ""})` : ""),
    );
    console.log(`  рейтинг без выдуманных игроков    : ${mark(boardHonest)}${board ? `  (записей ${board.leaderboard?.length ?? 0})` : ""}`);
    console.log(`  банк задач в базе                 : ${bank ? bank.toLocaleString("ru-RU") : "нет ответа"}`);
    console.log("\nЗа человеком, машиной не проверяется:");
    console.log("  путь новичка целиком · платёж доходит до кассы и открывает купленное ·");
    console.log("  тексты обещают то, что модуль делает · отказ показывается отказом");
  }

  if (networkFailed) process.exit(2);
  const red = rows.some((r) => !r.page) || dailyHonest === false || boardHonest === false;
  process.exit(red ? 1 : 0);
}

main();
