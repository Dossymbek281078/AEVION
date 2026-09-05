import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * В App Router теги <html> и <body> рисует ТОЛЬКО корневой layout. Страница,
 * которая рисует их сама, оказывается внутри чужих html/body: гидратация
 * падает (React #418), и человек видит ПУСТОЙ экран.
 *
 * Так с мая 2026 был сломан OBS-оверлей для стримеров — на любом gameId, а не
 * только на несуществующем. Замер 02.09.2026: 4 символа текста на странице и
 * одна ошибка в консоли. Ни один тест этого не видел: страница «отвечает 200»,
 * сборка проходит, типы чистые.
 */

const КОРЕНЬ = join(__dirname, "..");

function страницы(каталог: string, найдено: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    if (имя === "__tests__" || имя === "node_modules") continue;
    const п = join(каталог, имя);
    if (statSync(п).isDirectory()) страницы(п, найдено);
    else if (имя === "page.tsx" || имя === "layout.tsx") найдено.push(п);
  }
  return найдено;
}

describe("страницы модуля не рисуют собственный документ", () => {
  it("ни одна page.tsx не возвращает <html> или <body>", () => {
    const файлы = страницы(КОРЕНЬ).filter((ф) => ф.endsWith("page.tsx"));
    // контроль охвата: страниц у модуля два десятка, а не ноль
    expect(файлы.length).toBeGreaterThanOrEqual(15);
    // Комментарии вырезаем: и объяснение «здесь стояли <html> и <body>», и
    // чужая заметка про lang="ru" попадали под шаблон. Первый прогон нашёл
    // двух «нарушителей», и оба были комментариями — в том числе мой
    // собственный, написанный при починке.
    const нарушители = файлы
      .filter((ф) => /<\s*(html|body)[\s>]/.test(bezKommentariev(readFileSync(ф, "utf8"))))
      .map((ф) => ф.slice(КОРЕНЬ.length + 1));
    expect(нарушители).toEqual([]);
    // контроль прибора: на настоящей разметке он обязан срабатывать
    expect(/<\s*(html|body)[\s>]/.test(bezKommentariev('const a = <body style={{}}>x</body>;'))).toBe(true);
    // и не срабатывать на упоминании в комментарии
    expect(/<\s*(html|body)[\s>]/.test(bezKommentariev('// тут был <body>' + String.fromCharCode(10) + 'const a = 1;'))).toBe(false);
  });

  it("прозрачный фон оверлея ставится эффектом и возвращается назад", () => {
    const обс = readFileSync(join(КОРЕНЬ, "obs", "[gameId]", "page.tsx"), "utf8");
    // OBS кладёт страницу поверх видео — без прозрачности оверлей закроет кадр
    expect(обс).toContain('b.style.background = "transparent"');
    // и уборка обязательна: иначе прозрачный фон утечёт на соседние страницы
    expect(обс).toContain("return () => {");
  });
});
