import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Страница историй успеха НЕ имеет права показывать выдуманных людей.
 *
 * Замер 20.09.2026: на ней стояли четыре истории с именами, компаниями, городами
 * и цитатами («нашёл и нанял за 4 дня»), а подпись обещала «Реальные люди,
 * реальные найм» — при том что настоящих наймов на платформе НОЛЬ (20 записей
 * ленты оказались нашими смоук-прогонами). Выдуманный отзыв — не оформление,
 * а ложное доказательство: по нему принимают решение о деньгах.
 *
 * Сторож смотрит на СЛОВАРИ, а не на вёрстку: вернуть истории проще всего
 * строками, и тогда правка страницы ничего не значит.
 */
/** До каталога `src`: __tests__ → success-stories → build → app → src. */
const КОРЕНЬ = join(__dirname, "..", "..", "..", "..");
const ЯЗЫКИ = ["ru", "en", "kk"] as const;

describe("на витрине успеха нет выдуманных отзывов", () => {
  it("КОНТРОЛЬ прибора: словари читаются и в них есть строки этой страницы", () => {
    for (const l of ЯЗЫКИ) {
      const s = readFileSync(join(КОРЕНЬ, "lib/i18n-lang", `${l}.ts`), "utf8");
      expect(s.includes("build.successStories."), `${l}: строк страницы нет — сторож смотрит не туда`).toBe(true);
    }
  });

  it("историй с именами и цитатами в словарях НЕТ", () => {
    for (const l of ЯЗЫКИ) {
      const s = readFileSync(join(КОРЕНЬ, "lib/i18n-lang", `${l}.ts`), "utf8");
      const найдено = ["case1Quote", "case2Quote", "case3Quote", "case4Quote", "case1Name", "caseStudiesHeading"]
        .filter((k) => s.includes(`build.successStories.${k}`));
      expect(найдено, `${l}: вернулись выдуманные истории`).toEqual([]);
    }
  });

  it("подпись страницы не обещает «реальные люди», пока их нет", () => {
    const s = readFileSync(join(КОРЕНЬ, "lib/i18n-lang", "ru.ts"), "utf8");
    const строка = s.split("\n").find((l) => l.includes("build.successStories.heroSubtitle")) ?? "";
    expect(строка.length, "строки подписи нет вовсе").toBeGreaterThan(0);
    expect(/Реальные люди/i.test(строка), "обещание вернулось").toBe(false);
  });
});
