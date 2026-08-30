import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..");

// 20.08.2026. Класс, найденный ходьбой глазами: внутренние слова уезжают в
// текст для человека. Было в четырёх местах, включая КАРТИНКУ ДЛЯ СОЦСЕТЕЙ —
// её видит каждый, кому дали ссылку:
//
//   «Основан на CPI weak factor, due Coach reminders, и daily-variant ротации»
//   «F7 · Mock-режим: все операции сохраняются в localStorage браузера»
//   «обновляется через SSE»
//   «История · breakdown · weak factor → drill recommendation»
//
// Это записки разработчика, а не речь продукта.

// 28.08.2026: английские ярлыки самого интерфейса — не бренды, а недоделанный
// перевод. На первом экране новичка стояли «Vs Человек (Hotseat)», «Match Me»,
// «Quick start с текущими настройками», «12 вариантов · Hotseat · P2P», и два
// тоста: «Hotseat выкл» и «P2P соединение закрыто». Имена движка и форматов
// (Stockfish, Lichess, PGN, ELO, FEN) остаются как есть — это термины игры.
const ZHARGON =
  /\b(bracket|Coach |PiP|spaced.repetition|fallback|mock|polling|SSE|endpoint|payload|localStorage|cache|weak factor|SR reminders|backend|deprecated|TODO|FIXME|daily-variant|Coach Knowledge|training hub|hotseat|P2P|quick start|match me)\b/i;

// У кириллицы граница слова работает не так, как ждёшь, поэтому задаём её
// перечислением. 27.08.2026 сторож пропустил фразу «Очередь и матчи живут в
// памяти бэкенда» на странице поиска соперника: в списке было английское
// backend, а на экране стояло русское «бэкенд». Сторож был уже своего
// названия — обещал «нет жаргона», а ловил половину.
const ZHARGON_RU =
  /(^|[^а-яё])(пазл|лидерборд|провизорн|опт-ин|обвязка|пресет|бэкенд|бекенд|фронтенд|эндпоинт|деплой|пайплайн|фолбэк|поллинг|кэш|стейт|билд|стрик|буст)(а|у|е|ом|ов|ам|ами|ах)?([^а-яё]|$)/i;

// Технические следы: адрес серверной ручки, имя файла исходника, «Powered by».
// 28.08.2026 на «Турнирном хабе» посетителю показывали «Powered by
// buildBracket(players, results) из tournament.ts» и «Leaderboard: GET
// /api/cyberchess-tournaments/leaderboard (live, с фоллбэком на демо)» —
// три таких места на одной странице. Ни одно не ловилось: в списке были
// отдельные слова, а не эти формы.
const ТЕХСЛЕД = /(Powered by|GET \/api\/|POST \/api\/|\/api\/[a-z-]+\/|[a-zA-Z][a-zA-Z0-9]*\.tsx?)/;

function zhargon(t: string): boolean {
  return ZHARGON.test(t) || ZHARGON_RU.test(t) || ТЕХСЛЕД.test(t);
}

// Видимый текст берём между тегами и ЧЕРЕЗ ПЕРЕНОС СТРОКИ. Первая версия
// сторожа искала «>текст<» в пределах одной строки и дала ЛОЖНЫЙ НОЛЬ: на
// экране фраза разбита на две строки. Контроль на заведомо плохом файле — ниже.
// Позиции, из которых строка попадает человеку на глаза: подписи пунктов,
// заголовки карточек, подсказки, всплывающие сообщения, атрибуты доступности.
const POZICII =
  /(label:|title:|hint:|sub:|desc:|description:|name:|placeholder=|aria-label=|label=|showToast\()\s*"([^"]{4,300})"/g;

function vidimyjTekst(src: string): string[] {
  const bezKom = src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("\/\/") || t.startsWith("\*") || t.startsWith("\/\*"));
    })
    .join("\n");
  const out: string[] = [];
  for (const m of bezKom.matchAll(/>([^<>{}]{12,300})</g)) {
    const txt = m[1].replace(/\s+/g, " ").trim();
    // Дженерики TypeScript дают ложные "тексты": useState<Puzzle[]> кончается
    // на > , а следующий < открывает соседний дженерик, и между ними
    // оказывается код. 28.08.2026 сторож из-за этого покраснел на имени
    // переменной hotseat. Человеку на экране не показывают ни точку с запятой,
    // ни стрелку функции — по ним код и отличается от речи.
    if (txt.includes(";") || txt.includes("=>") || txt.includes("useState")) continue;
    // ЯЗЫК ТЕКСТА НЕ ВАЖЕН. Прежняя версия проверяла только строки, где есть
    // русский, и потому пропускала чисто английский жаргон: на дашборде CPI
    // человеку показывали «data: localStorage · key: aevion_cyberchess_cpi_v1».
    // Сторож назывался «нет жаргона на экране», а проверял «нет жаргона в
    // русских фразах» — уже своего имени.
    out.push(txt);
  }
  // Второй источник видимого текста: строковые литералы в позициях, которые
  // человек читает. 28.08.2026 выяснилось, что сторож их не видел НИКОГДА —
  // он брал только текст между тегами. Поэтому «Match Me», «Quick start
  // с текущими настройками», «Vs Человек (Hotseat)» и тост «Hotseat выкл»
  // спокойно дожили до недели запуска: сторож был зелёный и слеп.
  // Всплывающие сообщения часто выбираются тернарником — showToast(x ? "A" : "B").
  // Привязка «кавычка сразу после скобки» такие пропускает, поэтому вызов
  // разбирается целиком: берём каждую строку внутри него.
  for (const v of bezKom.matchAll(/showToast\(([^;]{0,400}?)\)/g)) {
    for (const lit of (v[1] ?? "").matchAll(/"([^"]{4,300})"/g)) {
      out.push(lit[1].replace(/\s+/g, " ").trim());
    }
  }
  for (const m of bezKom.matchAll(POZICII)) {
    const txt = (m[2] ?? "").replace(/\s+/g, " ").trim();
    if (txt.length >= 4) out.push(txt);
  }
  return out;
}

function stranicy(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") stranicy(p, acc);
    } else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

describe("на экране нет жаргона разработчика", () => {
  test("детектор ловит фразу, разбитую на две строки", () => {
    // Тот самый случай, на котором первая версия молча возвращала ноль.
    const obrazec = `<p>
            Твой план. Основан на CPI weak factor, due Coach reminders,
            и daily-variant ротации.
          </p>`;
    const najdeno = vidimyjTekst(obrazec).filter((t) => zhargon(t));
    expect(najdeno.length, "детектор не видит фразу через перенос строки").toBeGreaterThan(0);
  });

  test("детектор не срабатывает на нормальной речи", () => {
    const obrazec = "<p>Твой личный план на день: слабая сторона, темы для повторения и вариант дня.</p>";
    expect(vidimyjTekst(obrazec).filter((t) => zhargon(t))).toEqual([]);
  });

  test("во всём модуле чисто", () => {
    const files = stranicy(ROOT);
    expect(files.length, "обход не нашёл страниц — сторож ничего не проверил").toBeGreaterThan(50);
    const plohie: string[] = [];
    for (const f of files) {
      for (const t of vidimyjTekst(fs.readFileSync(f, "utf-8"))) {
        if (zhargon(t)) plohie.push(`${path.relative(ROOT, f)}: ${t.slice(0, 70)}`);
      }
    }
    expect(plohie).toEqual([]);
  });
});
