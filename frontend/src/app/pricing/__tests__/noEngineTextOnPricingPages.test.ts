/**
 * Публичные страницы цен не показывают человеку внутренности.
 *
 * Класс находили дважды: соседнее окно — на странице цен (покупателю выводили
 * адрес API и инструкцию запустить бэкенд), я — на форме связи. 03.09.2026
 * нашёл ещё два места: `/pricing/cases` и `/pricing/compare` печатали
 * «/api/pricing/cases — <сообщение движка>» прямо под заголовком об ошибке.
 *
 * Человек читает это в момент, когда ему и так не повезло, и вывод делает не
 * «сервис на минуту недоступен», а «у них всё сломано».
 *
 * Сторож закрепляет ДВЕ вещи: внутреннего адреса в разметке нет, и человеческая
 * подсказка есть. Первое без второго дало бы пустой экран вместо объяснения.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../__tests__/helpers/sourceCode";

const страницы = [
  "src/app/pricing/cases/page.tsx",
  "src/app/pricing/compare/page.tsx",
];

describe("страницы цен при отказе сервера", () => {
  it.each(страницы)("%s не печатает внутренний адрес ручки", (путь) => {
    const код = stripComments(readFileSync(join(process.cwd(), путь), "utf8"));
    // Ищем адрес ручки именно В РАЗМЕТКЕ: в fetch он законен и нужен.
    const вРазметке = /<p[^>]*>\s*\/api\//.test(код) || />\s*\/api\/[a-z/-]+\s*—/.test(код);
    expect(вРазметке, "внутренний адрес ручки уходит на экран").toBe(false);
  });

  it.each(страницы)("%s даёт человеку понятную подсказку", (путь) => {
    const код = stripComments(readFileSync(join(process.cwd(), путь), "utf8"));
    expect(код, "нет человеческой подсказки при отказе").toContain('tp("error.retryHint")');
  });

  it.each(страницы)("%s не теряет подробность — она уходит в журнал", (путь) => {
    const код = stripComments(readFileSync(join(process.cwd(), путь), "utf8"));
    // Убрать с экрана мало: без записи в журнал причина исчезает вовсе,
    // и следующий разбор начинается с нуля.
    expect(код, "подробность потеряна вместо журнала").toContain("console.warn(");
  });

  it("подсказка есть в обоих языках словаря цен", () => {
    const словарь = readFileSync(join(process.cwd(), "src/lib/pricingI18n.ts"), "utf8");
    const счёт = словарь.split('"error.retryHint"').length - 1;
    expect(счёт, "подсказка заведена не во всех языках").toBeGreaterThanOrEqual(2);
  });
});
