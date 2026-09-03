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
