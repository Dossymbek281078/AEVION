import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CASE_STUDIES } from "../src/data/cases";
import { UNPUBLISHED_FICTIONAL_CASES } from "../src/data/cases.unpublished";

/**
 * Публичная ручка /api/pricing/cases не имеет права отдавать вымышленные
 * «истории клиентов»: названия компаний, метрики ROI и цитаты с именами — это
 * доказательство, которого у нас нет (оплат за всё время три). Комментарий в
 * шапке data/cases.ts признавал это прямым текстом: «цитаты фиктивные».
 *
 * Сторож закрывает обратную дорогу: вернуть их проще всего одной строкой.
 */
describe("вымышленные кейсы не публикуются", () => {
  test("КОНТРОЛЬ прибора: тексты никуда не делись — их шесть", () => {
    expect(UNPUBLISHED_FICTIONAL_CASES.length, "тексты потеряны — это не то, чего мы хотели").toBe(6);
    expect(
      UNPUBLISHED_FICTIONAL_CASES.some((c) => JSON.stringify(c.quote ?? "").length > 8),
      "в сохранённых нет цитат — читаю не тот файл",
    ).toBe(true);
  });

  test("публичный список пуст", () => {
    expect(CASE_STUDIES, "вымышленные кейсы вернулись в публикацию").toEqual([]);
  });

  test("непубликуемый файл никем не импортируется, кроме этого теста", () => {
    const корень = join(__dirname, "..", "src");
    const найдено: string[] = [];
    const обойти = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) obhod(p);
        else if (/[.]ts$/.test(e.name)) {
          // Ищем именно ИМПОРТ, а не упоминание в комментарии: в cases.ts стоит
          // ссылка на этот файл словами, и без уточнения сторож краснел на ней.
          const текст = readFileSync(p, "utf8");
          if (текст.includes('from "./cases.unpublished"') || текст.includes('from "../data/cases.unpublished"')) найдено.push(p);
        }
      }
    };
    const obhod = обойти;
    обойти(корень);
    expect(найдено, "непубликуемые истории кто-то импортировал в боевой код").toEqual([]);
  });
});

import { readdirSync } from "node:fs";
