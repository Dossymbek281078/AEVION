import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Согласование числительного реализовано ДВАЖДЫ: в routes/qskyway.ts и в
 * frontend/src/app/qskyway/_client.tsx. Рядом стоит комментарий «ровно то же
 * поведение» — но это обещание, и до 28.08.2026 его никто не проверял.
 *
 * Дублирование здесь не небрежность: сервер кладёт пояснение в ответ, страница
 * рисует своё в подсказке, и тянуть общий модуль через границу половин дороже,
 * чем повторить пять строк. Но раз повторили — пусть расхождение падает.
 *
 * Чем грозит расхождение: одно и то же число будет написано по-разному в
 * ответе API и на экране. Ровно ту болезнь модуль и лечит в данных — «продукт
 * называет одну величину двумя числами».
 *
 * В тот же день выяснилось, что это не теория: скобочная форма «участк(ах)»
 * жила в ОБЕИХ половинах, и починка одной оставляла вторую.
 */

const NL = String.fromCharCode(10);

function bodyOf(file: string): string {
  const src = readFileSync(file, "utf8");
  const start = src.indexOf("function plural(");
  expect(start, "функция plural не найдена в " + path.basename(file)).toBeGreaterThan(-1);
  // Тело кончается строкой, состоящей из одной закрывающей скобки на нулевом
  // отступе: так объявлены обе. Ищем её, а не считаем скобки — счёт скобок
  // ломается о фигурные скобки внутри шаблонных строк.
  const lines = src.slice(start).split(NL);
  const out: string[] = [];
  for (const l of lines) {
    out.push(l.trim());
    if (l === "}") break;
  }
  return out.join(NL);
}

const BACK = path.join(__dirname, "..", "src", "routes", "qskyway.ts");
const FRONT = path.join(__dirname, "..", "..", "frontend", "src", "app", "qskyway", "_client.tsx");

describe("две реализации склонения числительного совпадают", () => {
  it("контроль прибора: обе функции найдены и не пусты", () => {
    // Без этого «совпадают» неотличимо от «обе пустые».
    expect(bodyOf(BACK).length).toBeGreaterThan(120);
    expect(bodyOf(FRONT).length).toBeGreaterThan(120);
    expect(bodyOf(BACK)).toContain("mod100");
  });

  it("тела функций совпадают строка в строку", () => {
    expect(
      bodyOf(FRONT),
      "реализации склонения разошлись. Одно и то же число будет написано "
        + "по-разному в ответе API и на экране — та самая болезнь, которую "
        + "модуль лечит в данных. Приведите обе к одному виду.",
    ).toBe(bodyOf(BACK));
  });
});
