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

const ZHARGON =
  /\b(fallback|mock|polling|SSE|endpoint|payload|localStorage|cache|weak factor|SR reminders|backend|deprecated|TODO|FIXME|daily-variant|Coach Knowledge|training hub)\b/i;

// Видимый текст берём между тегами и ЧЕРЕЗ ПЕРЕНОС СТРОКИ. Первая версия
// сторожа искала «>текст<» в пределах одной строки и дала ЛОЖНЫЙ НОЛЬ: на
// экране фраза разбита на две строки. Контроль на заведомо плохом файле — ниже.
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
    // ЯЗЫК ТЕКСТА НЕ ВАЖЕН. Прежняя версия проверяла только строки, где есть
    // русский, и потому пропускала чисто английский жаргон: на дашборде CPI
    // человеку показывали «data: localStorage · key: aevion_cyberchess_cpi_v1».
    // Сторож назывался «нет жаргона на экране», а проверял «нет жаргона в
    // русских фразах» — уже своего имени.
    out.push(txt);
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
    const najdeno = vidimyjTekst(obrazec).filter((t) => ZHARGON.test(t));
    expect(najdeno.length, "детектор не видит фразу через перенос строки").toBeGreaterThan(0);
  });

  test("детектор не срабатывает на нормальной речи", () => {
    const obrazec = "<p>Твой личный план на день: слабая сторона, темы для повторения и вариант дня.</p>";
    expect(vidimyjTekst(obrazec).filter((t) => ZHARGON.test(t))).toEqual([]);
  });

  test("во всём модуле чисто", () => {
    const files = stranicy(ROOT);
    expect(files.length, "обход не нашёл страниц — сторож ничего не проверил").toBeGreaterThan(50);
    const plohie: string[] = [];
    for (const f of files) {
      for (const t of vidimyjTekst(fs.readFileSync(f, "utf-8"))) {
        if (ZHARGON.test(t)) plohie.push(`${path.relative(ROOT, f)}: ${t.slice(0, 70)}`);
      }
    }
    expect(plohie).toEqual([]);
  });
});
