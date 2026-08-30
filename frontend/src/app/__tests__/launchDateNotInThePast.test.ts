import { describe, test, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Ни одна посадочная не обещает дату, которая уже прошла.
 *
 * 30.08.2026 страница запуска шахмат писала «Открываем 30 августа» и тут же
 * «Уже открыто»: отсчёт дошёл до нуля, а запуска не было — его перенесли на
 * сентябрь, и дату забыли поменять. То же висело на /go, самой видной странице
 * платформы. Заметил падающий тест про письмо, а не человек и не сторож.
 *
 * Эта проверка нарочно ЗАВИСИТ ОТ СЕГОДНЯШНЕГО ДНЯ. Обычно это недостаток, но
 * здесь в этом весь смысл: обещание протухает по календарю, и краснеть сторож
 * должен именно в день, когда обещание стало ложным. Чинится он не правкой
 * теста, а решением — перенести дату или убрать отсчёт.
 *
 * Эталонных дат сторож не знает: он не устареет от следующего переноса.
 *
 * ГРАНИЦА, названная честно. Сегодняшний случай он поймал бы только ЗАВТРА:
 * дата равна сегодняшнему дню, а в день запуска «Открываем сегодня» —
 * законная надпись. Проверено мутацией: дата = сегодня проходит, дата на
 * десять дней назад краснеет. То есть сторож ловит ЗАБЫТОЕ обещание, а не
 * несостоявшийся запуск в день его объявления. Второе ловится только тем,
 * что человек посмотрел на страницу.
 */
const APP = join(process.cwd(), "src/app");

function launchPages(): string[] {
  const out: string[] = [];
  for (const d of readdirSync(APP, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const p = join(APP, d.name, "launch", "page.tsx");
    if (existsSync(p)) out.push(p);
  }
  return out;
}

/** Дата из daysUntilLaunch(Date.UTC(год, месяц, день)) — позиционно, без регулярки. */
function promisedDate(src: string): { ms: number; where: string } | null {
  const marker = "daysUntilLaunch(Date.UTC(";
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const inside = src.slice(i + marker.length, i + marker.length + 24).split(")")[0];
  const nums = inside.split(",").map((s) => Number(s.trim()));
  if (nums.length < 3 || nums.some((n) => !Number.isFinite(n))) return null;
  return { ms: Date.UTC(nums[0], nums[1], nums[2]), where: inside };
}

describe("посадочные не обещают прошедших дат", () => {
  const pages = launchPages();

  test("посадочные вообще найдены — иначе проверка пуста", () => {
    expect(pages.length, "не найдено ни одной страницы */launch/page.tsx").toBeGreaterThan(0);
  });

  for (const p of pages) {
    const name = p.split(/[\/]/).slice(-3, -2)[0];
    test(`${name}: обещанная дата не в прошлом`, () => {
      const d = promisedDate(readFileSync(p, "utf8"));
      if (!d) return; // страница без отсчёта ничего не обещает — проверять нечего
      const today = Date.UTC(
        new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(),
      );
      expect(
        d.ms >= today,
        `страница ${name} обещает запуск на Date.UTC(${d.where}), а он уже прошёл. ` +
        "Либо перенесите дату, либо уберите отсчёт — сейчас страница обещает вчерашнее.",
      ).toBe(true);
    });
  }
});
