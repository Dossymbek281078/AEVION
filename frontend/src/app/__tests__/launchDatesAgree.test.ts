import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Внутри одного модуля дата запуска названа ОДИНАКОВО везде.
 *
 * 30.08.2026 дата шахмат жила в тринадцати местах: посадочная, картинка для
 * соцсетей, /go, три письма. Перенос применили к двум — остальные продолжали
 * обещать вчерашнее, и самой видной из них была /go.
 *
 * Прежние сторожа сверяли ПАРЫ мест, каждый свою. Этот ищет места сам: новое
 * четырнадцатое не появится незамеченным, потому что он не знает их списка —
 * он обходит каталоги и собирает всё, что похоже на обещание даты.
 *
 * Эталонных дат не знает: краснеет только когда места ОДНОГО модуля спорят.
 *
 * ГРАНИЦА. Смотрит только каталоги `app/<модуль>/launch`. Страница /go живёт
 * снаружи и сверяется отдельным сторожем (goDateMatchesLanding), письма — своим
 * (launchDateIsOneNumber на бэкенде). Три сторожа делят между собой три места,
 * где обещание может разъехаться; ни один не знает «правильной» даты.
 *
 * Проверено мутациями: развести дату внутри модуля — краснеет; сломать обход
 * каталогов так, что проверять становится нечего, — тоже краснеет.
 */
const APP = join(process.cwd(), "src/app");
const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл",
                "август", "сентябр", "октябр", "ноябр", "декабр"];

/** Даты после слов-маркеров, позиционно: собранная из строки регулярка здесь уже теряла слэши. */
function datesIn(src: string): string[] {
  const out: string[] = [];
  for (const marker of ["Открываем ", "открываем ", "запуск "]) {
    let i = src.indexOf(marker);
    while (i >= 0) {
      const tail = src.slice(i + marker.length, i + marker.length + 24);
      const m = MONTHS.find((mo) => tail.includes(mo));
      if (m) {
        const num = tail.split(" ")[0].trim();
        if (/^\d{1,2}$/.test(num)) out.push(`${num} ${m}`);
      }
      i = src.indexOf(marker, i + 1);
    }
  }
  return out;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__") out.push(...filesUnder(p)); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("дата запуска не спорит сама с собой", () => {
  const modules = readdirSync(APP, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(APP, d.name, "launch")))
    .map((d) => d.name);

  test("посадочные вообще найдены — иначе проверка пуста", () => {
    expect(modules.length, "не найдено ни одного каталога */launch").toBeGreaterThan(0);
  });

  for (const mod of modules) {
    test(`${mod}: все места называют одну дату`, () => {
      const found: Array<{ file: string; date: string }> = [];
      for (const f of filesUnder(join(APP, mod, "launch"))) {
        for (const d of datesIn(readFileSync(f, "utf8"))) {
          found.push({ file: f.split(/[\/]/).slice(-1)[0], date: d });
        }
      }
      if (found.length === 0) return; // модуль без обещания даты
      const uniq = [...new Set(found.map((f) => f.date))];
      expect(
        uniq.length,
        `модуль ${mod} обещает РАЗНЫЕ даты: ` +
          found.map((f) => `${f.file}→«${f.date}»`).join(", "),
      ).toBe(1);
    });
  }
});
