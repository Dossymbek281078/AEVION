import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * У охвата сторожа ДВА измерения: какая ФОРМА слова и какие ФАЙЛЫ.
 *
 * 01.09 я убрал одиночное «AI» и поставил сторож — он читал page.tsx и искал
 * слово. 03.09 нашлись восемь составных «AI-…» в том же файле (форма) и ещё
 * три в соседних (охват), включая «aevion.app · AI-powered chess» на
 * КАРТИНКЕ, которую игрок публикует в соцсетях, и пять английских названий
 * раскладок рабочего стола — Focus, Standard, Stream, Study, Coach.
 *
 * Этот сторож закрывает второе измерение: весь модуль, а не один файл.
 */

const КОРЕНЬ = join(__dirname, "..");

function исходники(каталог: string, найдено: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    if (имя === "__tests__" || имя === "node_modules") continue;
    const п = join(каталог, имя);
    if (statSync(п).isDirectory()) исходники(п, найдено);
    else if (/\.tsx?$/.test(имя)) найдено.push(п);
  }
  return найдено;
}

describe("английские подписи по всему модулю", () => {
  it("нигде нет составного «AI-…»", () => {
    const файлы = исходники(КОРЕНЬ);
    // контроль охвата: обход дошёл до реальных файлов модуля, а не до пустоты
    expect(файлы.length).toBeGreaterThan(100);
    const места = файлы
      .map((ф) => ({ ф, n: (bezKommentariev(readFileSync(ф, "utf8")).match(/AI-/g) || []).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.ф.slice(КОРЕНЬ.length + 1)}: ${x.n}`);
    expect(места).toEqual([]);
  });

  /**
   * ТРЕТЬЕ измерение охвата: одиночное «AI» ВНУТРИ русской фразы.
   *
   * Прежние два правила ловили составное «AI-…» и английские имена раскладок.
   * 04.09 вычитка дифа показала 38 мест вида «Ход AI», «Победи AI уровня
   * Expert», «играй с AI без сети» — форма без дефиса, и потому невидимая.
   *
   * Условие «в той же строке есть кириллица» здесь не украшение, а защита от
   * ложных срабатываний: строки движка («AI wins», «Checkmate — AI») русских
   * букв не содержат, их СРАВНИВАЮТ с ответом Stockfish, и переводить их
   * нельзя. Казахские строки пропускаем намеренно: перевод туда — отдельная
   * работа, гадать нельзя.
   */
  it("нигде нет одиночного «AI» внутри русской фразы", () => {
    const файлы = исходники(КОРЕНЬ);
    expect(файлы.length).toBeGreaterThan(100);

    const кириллица = /[А-Яа-яЁё]/;
    const казахские = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;
    const буква = /[A-Za-z-]/;

    // отдельное слово AI: соседей-латиницы и дефиса нет ни слева, ни справа
    const одиночноеAI = (текст: string): boolean => {
      for (let i = текст.indexOf("AI"); i >= 0; i = текст.indexOf("AI", i + 1)) {
        const слева = i > 0 ? текст[i - 1] : " ";
        const справа = i + 2 < текст.length ? текст[i + 2] : " ";
        if (!буква.test(слева) && !буква.test(справа)) return true;
      }
      return false;
    };

    const подозрительный = (кусок: string): boolean =>
      кириллица.test(кусок) && !казахские.test(кусок) && одиночноеAI(кусок);

    const места: string[] = [];
    for (const ф of файлы) {
      for (const строка of bezKommentariev(readFileSync(ф, "utf8")).split(String.fromCharCode(10))) {
        const куски = [
          ...(строка.match(/"[^"]*"/g) || []),
          ...(строка.match(/'[^']*'/g) || []),
          ...(строка.match(/`[^`]*`/g) || []),
          ...[...строка.matchAll(/>([^<>{}]*)</g)].map((m) => m[1]),
        ];
        if (куски.some(подозрительный)) места.push(`${ф.slice(КОРЕНЬ.length + 1)}: ${строка.trim().slice(0, 60)}`);
      }
    }
    expect(места).toEqual([]);
  });

  it("названия раскладок рабочего стола — русские", () => {
    const код = bezKommentariev(readFileSync(join(КОРЕНЬ, "useWorkspace.ts"), "utf8"));
    const имена = [...код.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
    expect(имена.length).toBeGreaterThanOrEqual(5);
    const английские = имена.filter((n) => !/[А-Яа-яЁё]/.test(n));
    expect(английские).toEqual([]);
  });

  it("картинка для соцсетей подписана по-русски", () => {
    // Это самая публичная поверхность модуля: её видят те, кто ещё не играл.
    const код = readFileSync(join(КОРЕНЬ, "gameShare.ts"), "utf8");
    expect(код).not.toContain("AI-powered");
    expect(код).toContain("шахматы с ИИ");
  });
});
