import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: цены в ИНСТРУКЦИИ по настройке кассы совпадают с тарифами.
 *
 * Повод (29.08.2026). В шапке lemonSqueezyVariants.ts лежало указание
 * человеку: завести в LemonSqueezy варианты по $24/$39/$89. Это цены
 * от 22.07; 13.08 их вернули к 19/29/49 (d424fbf07), и pricing.ts вместе
 * с ответом прода говорит именно так. Настроивший кассу по инструкции
 * списывал бы с покупателя БОЛЬШЕ, чем обещает витрина, — а несовпадение
 * витрины и списания в этом файле уже случалось раньше и описано в нём же.
 *
 * Комментарий — не код, его не проверяет ни тип, ни тест: он стареет
 * молча. Здесь он проверяется, потому что по нему делают денежное
 * действие руками.
 *
 * Знаменатель честный: три тарифа, у каждого месяц и год.
 */
const ФАЙЛ = join(__dirname, "..", "src", "data", "lemonSqueezyVariants.ts");
const ЦЕНЫ = join(__dirname, "..", "src", "data", "pricing.ts");

/** Месячная цена тарифа из pricing.ts — источник правды. */
function тариф(id: string): number {
  const s = readFileSync(ЦЕНЫ, "utf8");
  const i = s.indexOf(`id: "${id}"`);
  expect(i, `тариф ${id} не найден в pricing.ts`).toBeGreaterThan(-1);
  const m = /priceMonthly:\s*([0-9]+)/.exec(s.slice(i, i + 700));
  expect(m, `у тарифа ${id} не найдена priceMonthly`).not.toBeNull();
  return Number(m![1]);
}

describe("инструкция по настройке кассы не расходится с тарифами", () => {
  const текст = readFileSync(ФАЙЛ, "utf8");

  for (const [id, имя] of [["lite", "Lite"], ["medium", "Medium"], ["full", "Full"]]) {
    it(`${имя}: цена в инструкции равна тарифу`, () => {
      const цена = тариф(id);
      // Строка вида " *      - Lite   $19/mo  + $190/yr variant"
      const строка = текст.split(String.fromCharCode(10)).find((l) => l.includes(`- ${имя}`) && l.includes("/mo"));
      expect(строка, `в инструкции нет строки настройки для ${имя}`).toBeTruthy();
      const m = /\$([0-9]+)\/mo\s+\+\s+\$([0-9]+)\/yr/.exec(строка!);
      expect(m, `в инструкции нет строки настройки для ${имя}`).not.toBeNull();
      expect(Number(m![1]), `${имя}: инструкция велит взять не ту цену`).toBe(цена);
      expect(Number(m![2]), `${имя}: годовая цена в инструкции не равна 10 месяцам`).toBe(цена * 10);
    });
  }

  it("строка «MUST match» называет действующие цены", () => {
    const m = /lite (\d+)\/(\d+), medium (\d+)\/(\d+), full (\d+)\/(\d+)/.exec(текст);
    expect(m, "строка со сводкой цен исчезла из инструкции").not.toBeNull();
    expect([Number(m![1]), Number(m![3]), Number(m![5])]).toEqual([
      тариф("lite"), тариф("medium"), тариф("full"),
    ]);
  });
});
