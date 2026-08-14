import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { CONSTITUTION_TIERS, MODULES_PRICING, getTier } from "../src/data/pricing";

/**
 * Цена одного товара обязана иметь ОДИН источник.
 *
 * 13.08.2026 этот класс сработал трижды за день: касса считала сумму своей
 * арифметикой мимо buildQuote; отчёт держал копию таблицы исключений; маршрут
 * Конституции — собственный прайс `{ pro: 9, team: 49 }`. Каждый случай по
 * отдельности выглядел исправным, потому что копии совпадали. Расходятся такие
 * копии молча, и заметить это можно только сравнив — то есть там, куда никто
 * не смотрит.
 *
 * Сторож смотрит на маршруты оплаты: если в них появится своя таблица цен или
 * своя арифметика итога, прогон покраснеет.
 */

const ROUTES = resolve(__dirname, "../src/routes");

/** Файлы, где ходят деньги. Список явный: неявный «все роуты» шумит. */
const PAYMENT_ROUTES = [
  "checkout.ts",
  "constitutionCheckout.ts",
  "gumroadWebhook.ts",
  "lemonSqueezyWebhook.ts",
  "payboxWebhook.ts",
  "paypalWebhook.ts",
];

/**
 * Строки, которые считаются объявлением своей цены. Ищем ПРИСВОЕНИЕ числа
 * идентификатору с ценовым именем — не любое упоминание слова "price", иначе
 * сторож краснел бы на комментариях и на чтении чужих полей.
 */
const OWN_PRICE_TABLE = /(?:const|let)\s+[A-Z_]*(?:PRICE|PRICES|USD|AMOUNT)[A-Z_]*\s*(?::[^=]*)?=\s*\{/;
const OWN_PRICE_LITERAL = /(?:const|let)\s+[a-zA-Z_]*(?:[Pp]rice|Usd|USD)[a-zA-Z_]*\s*=\s*\d+(?:\.\d+)?\s*[;,]/;

function sourceOf(file: string): string {
  return readFileSync(join(ROUTES, file), "utf8");
}

/** Убираем комментарии: объяснение дефекта не должно считаться дефектом. */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("цена имеет один источник", () => {
  test("в маршрутах оплаты нет собственных таблиц цен", () => {
    const offenders: string[] = [];

    for (const file of PAYMENT_ROUTES) {
      const src = withoutComments(sourceOf(file));
      for (const [i, line] of src.split("\n").entries()) {
        if (OWN_PRICE_TABLE.test(line) || OWN_PRICE_LITERAL.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 70)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test("контроль: сторож ловит подсунутую таблицу", () => {
    // Без этого первый случай прошёл бы и на пустом наборе правил.
    const fake = "const TIER_PRICES_USD: Record<Tier, number> = {";
    expect(OWN_PRICE_TABLE.test(fake)).toBe(true);
    const fake2 = "const priceUsd = 49;";
    expect(OWN_PRICE_LITERAL.test(fake2)).toBe(true);
    // И НЕ ловит безобидное: чтение чужого поля и упоминание в тексте.
    expect(OWN_PRICE_TABLE.test("const price = quote.total;")).toBe(false);
    expect(OWN_PRICE_LITERAL.test("const totalUsd = quote.total;")).toBe(false);
  });

  test("касса не считает сумму сама — она берёт её из общего расчёта", () => {
    const src = withoutComments(sourceOf("checkout.ts"));

    expect(src).toContain("buildQuote(");
    // Прежняя арифметика: накопление итога вручную.
    expect(src).not.toMatch(/totalUsd\s*\+=/);
  });

  test("цена Constitution Pro совпадает с ценой модуля — это один товар", () => {
    const mod = MODULES_PRICING.find((m) => m.id === "constitution");

    expect(mod?.addonMonthly).toBe(CONSTITUTION_TIERS.pro.priceUsd);
  });

  test("тарифы платформы читаются из прайса, а не из копий", () => {
    // Смысловая проверка: getTier — единственный вход к цене тарифа.
    for (const id of ["lite", "medium", "full"] as const) {
      const t = getTier(id);
      expect(t?.priceMonthly, `${id} без цены`).toBeGreaterThan(0);
    }
  });

  test("годовая цена дешевле месячной, и три числа карточки согласованы", () => {
    // 13.08.2026 цены снизили, но priceAnnualPerMonth остался считаться от
    // старых: Lite показывал $20/мес при месячной цене $19, Universe — $208
    // при $149. Год выглядел ДОРОЖЕ месяца, хотя рядом обещаны «2 месяца в
    // подарок». Проверяем не формулу, а СМЫСЛ: скидка есть, и годовой итог
    // согласован с годовой ценой в месяц.
    for (const id of ["lite", "medium", "full", "pro"] as const) {
      const t = getTier(id);
      const monthly = t?.priceMonthly ?? 0;
      const perMonth = t?.priceAnnualPerMonth ?? 0;
      const total = t?.priceAnnualTotal ?? 0;

      expect(monthly, `${id} без месячной цены`).toBeGreaterThan(0);
      expect(
        perMonth,
        `${id}: годовая ($${perMonth}/мес) не дешевле месячной ($${monthly}/мес) — скидки нет`,
      ).toBeLessThan(monthly);

      // Итог за год и цена «в месяц» обязаны описывать ОДНУ сделку.
      expect(
        Math.abs(total / 12 - perMonth),
        `${id}: $${total} за год — это $${(total / 12).toFixed(2)}/мес, а карточка обещает $${perMonth}/мес`,
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test("шапка pricing.ts называет ТЕ ЖЕ цены, что и тарифы под ней", () => {
    // Комментарий — пересказ, и 13.08.2026 он разошёлся с делом: цены снизили
    // ($24/$39/$89/$249.99 → $19/$29/$49/$149), а шапку не тронули. Читатель
    // (и я сам) верит первому, что видит, — то есть враньё стояло в самом
    // начале файла-источника истины по ценам.
    const src = readFileSync(join(__dirname, "..", "src", "data", "pricing.ts"), "utf8");
    const head = src.slice(0, src.indexOf("export const TIERS"));

    for (const id of ["lite", "medium", "full", "pro"] as const) {
      const price = getTier(id)?.priceMonthly;
      expect(price, `${id} без цены`).toBeGreaterThan(0);

      // Разбираем построчно, а не одной регуляркой: в шаблонной строке `\s`
      // означает букву s, и собранное так выражение молча не находит ничего —
      // сторож стал бы вечно зелёным. Проверено: на верной шапке он краснел.
      const line = head
        .split("\n")
        .find((l) => l.includes(`- ${id} `) && l.includes("$"));
      expect(line, `в шапке нет строки про ${id} — сторож ослеп`).toBeTruthy();

      const claimed = /\$([\d.]+)/.exec(line as string)?.[1];
      expect(claimed, `в строке про ${id} нет цены`).toBeTruthy();
      expect(
        Number(claimed),
        `шапка обещает $${claimed} за ${id}, а тариф стоит $${price}`,
      ).toBe(price);
    }
  });
});
