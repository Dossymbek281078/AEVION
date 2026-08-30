import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Сторож против МОЛЧАЛИВОЙ потери источника покупки.
 *
 * Замер 28.08.2026: воронка теряла метку канала на двух переходах — и оба раза
 * незаметно. Целевая страница канал читает, ссылка на неё метки не несёт,
 * покупка приходит в отчёт как «источник неизвестен». Ни один тест этого не
 * видел: страница работает одинаково с меткой и без.
 *
 * Правило простое: если страница ЧИТАЕТ канал (зовёт channelFrom), то ссылки на
 * неё обязаны его НЕСТИ — через keepChannel, а не строкой.
 */

const APP = path.join(process.cwd(), "src", "app");
const COMPONENTS = path.join(process.cwd(), "src", "components");

/** Шапка сайта — осознанное исключение, а не недосмотр.
 *
 *  Она рендерится на ВСЕХ страницах через ClientProviders и параметров страницы
 *  не получает. Единственный способ дать ей канал — useSearchParams(), а это
 *  Suspense и риск увести 762 статические страницы в динамический рендер. Цена
 *  несоразмерна: метка теряется на одной навигационной ссылке, а платит вся
 *  платформа. Решение пересматривать вместе с рендерингом макета, не отдельно. */
const KNOWN_EXCEPTIONS = new Set(["components/SiteHeader.tsx"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      out.push(...walk(full));
    } else if (e.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("метка канала переживает внутренние переходы", () => {
  const appFiles = walk(APP);
  const allFiles = [...appFiles, ...walk(COMPONENTS)];

  /** Пути страниц, которые читают канал, — то есть те, для кого метка не мусор. */
  const targets = appFiles
    .filter((f) => f.endsWith(`${path.sep}page.tsx`))
    .filter((f) => fs.readFileSync(f, "utf8").includes("channelFrom"))
    .map((f) => {
      const rel = path.relative(APP, path.dirname(f)).split(path.sep).join("/");
      return rel === "" ? "/" : `/${rel}`;
    });

  it("такие страницы вообще существуют — иначе сторож проверяет пустоту", () => {
    // Без этого утверждения список целей мог бы стать пустым (переименовали
    // channelFrom, переехали страницы), и сторож остался бы зелёным, ничего
    // не проверяя. Молчаливо слепой сторож хуже, чем его отсутствие.
    expect(targets.length).toBeGreaterThanOrEqual(5);
  });

  it("ни одна ссылка на них не потеряла метку", () => {
    const lost: string[] = [];
    for (const file of allFiles) {
      const rel = path.relative(path.join(process.cwd(), "src"), file).split(path.sep).join("/");
      if (KNOWN_EXCEPTIONS.has(rel)) continue;
      const src = fs.readFileSync(file, "utf8");
      for (const t of targets) {
        // ТРИ формы записи одной и той же ссылки. Сторож знал только первую,
        // и мутация 30.08.2026 прошла незамеченной: замена keepChannel(...) на
        // литерал даёт href={"/путь"} — в фигурных скобках, мимо шаблона.
        // У слепоты сторожа два измерения: какие файлы он читает и какие ФОРМЫ
        // видит. Охват был верным, форма — нет.
        const forms = [`href="${t}"`, `href={"${t}"}`, `href={'${t}'}`];
        if (forms.some((f) => src.includes(f))) lost.push(`${rel} → ${t}`);
      }
    }
    expect(lost).toEqual([]);
  });

  it("нормализованное значение не подставляют в ?c= руками", () => {
    // ВТОРОЙ ОБЛИК того же класса, и он тише первого: ссылка выглядит несущей
    // метку, проходит вычитку — и молча её теряет, потому что в ?c= уезжает
    // длинное значение (youtube), а следующая страница ждёт короткий ключ (yt).
    // Замер 29.08.2026: две такие подстановки на странице запуска шахмат.
    const handmade: string[] = [];
    for (const file of allFiles) {
      const rel = path.relative(path.join(process.cwd(), "src"), file).split(path.sep).join("/");
      const src = fs.readFileSync(file, "utf8");
      if (src.includes("c=${channel}")) handmade.push(rel);
    }
    expect(handmade).toEqual([]);
  });

  it("исключение названо честно и всё ещё существует", () => {
    // Исключение, указывающее в пустоту, — это забытая строка, которая молча
    // расширяет дыру: файл переименуют, а сторож продолжит кого-то пропускать.
    for (const rel of KNOWN_EXCEPTIONS) {
      expect(fs.existsSync(path.join(process.cwd(), "src", rel))).toBe(true);
    }
  });
});
