import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 В CSS-литералах компонентов нет служебного русского текста: он уезжает в HTML.
 *
 * Повод 13.10.2026 (bd): 1143 знака внутреннего разбора («доклад был неверен
 * дважды…») лежали внутри <style>{`…`}</style> общей шапки и уходили в исходник
 * четырёх публичных страниц — /proof, /devhub, /pricing, /bureau, где мы продаём
 * проверяемость. Секретов нет, но это разговор не для клиента. Свип по всем
 * компонентам и страницам со знаменателем.
 */
const КОРЕНЬ = join(process.cwd(), "src");

function файлы(dir: string, acc: string[] = []): string[] {
  for (const имя of readdirSync(dir)) {
    const p = join(dir, имя);
    if (имя === "__tests__" || имя === "node_modules") continue;
    if (statSync(p).isDirectory()) файлы(p, acc);
    else if (/\.tsx$/.test(имя)) acc.push(p);
  }
  return acc;
}

/** Все CSS-литералы вида <style>{`…`}</style> и <style jsx>{`…`}</style>. */
function cssЛитералы(текст: string): string[] {
  const out: string[] = [];
  const re = /<style[^>]*>\{`([\s\S]*?)`\}<\/style>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(текст))) out.push(m[1]);
  return out;
}

describe("стили без служебного текста", () => {
  it("🔴 ни в одном CSS-литерале нет кириллицы (комментарии разбора — в JSX или TS, не в CSS)", () => {
    const список = файлы(КОРЕНЬ);
    expect(список.length, "знаменатель: .tsx просмотрено").toBeGreaterThan(200);
    let литералов = 0;
    const нарушители: string[] = [];
    for (const f of список) {
      const т = readFileSync(f, "utf8");
      for (const css of cssЛитералы(т)) {
        литералов += 1;
        if (/[а-яА-ЯёЁ]/.test(css)) нарушители.push(f.slice(КОРЕНЬ.length + 1) + " (" + (css.match(/[а-яА-ЯёЁ]/g) || []).length + " кир. знаков)");
      }
    }
    expect(литералов, "знаменатель: CSS-литералов найдено").toBeGreaterThan(5);
    expect(нарушители).toEqual([]);
  });

  it("КОНТРОЛЬ: прибор видит литерал и кириллицу в нём", () => {
    const пример = "<style>{`\n .a { color: red; } /* разбор по-русски */\n`}</style>";
    const л = cssЛитералы(пример);
    expect(л.length).toBe(1);
    expect(/[а-яА-Я]/.test(л[0])).toBe(true);
    expect(cssЛитералы("<style>{`.b{}`}</style>")[0]).not.toMatch(/[а-яА-Я]/);
  });

  it("шапка сайта: разбор остался в JSX-комментарии, а не исчез", () => {
    const т = readFileSync(join(КОРЕНЬ, "components/SiteHeader.tsx"), "utf8");
    expect(т).toContain("elementFromPoint");
    expect(cssЛитералы(т).join("")).not.toMatch(/[а-яА-Я]/);
  });
});
