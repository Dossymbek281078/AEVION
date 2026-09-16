import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as pricing from "../src/data/pricing";
import {
  MODULES_PRICING, getTier, standaloneApp, TERM_TIERS, TERM_MONTHS, PLANET_BASE_MONTHLY, termPricePerMonth,
} from "../src/data/pricing";

/**
 * Цена одного товара обязана иметь ОДИН источник.
 *
 * 13.08.2026 этот класс сработал трижды за день: касса считала сумму своей
 * арифметикой мимо buildQuote; отчёт держал копию таблицы исключений; маршрут
 * Конституции — собственный прайс `{ pro: 9, team: 49 }`. Каждый случай по
 * отдельности выглядел исправным, потому что копии совпадали. Расходятся такие
 * копии молча, и заметить это можно только сравнив — там, куда никто не смотрит.
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
    // Цена отдельного приложения — тоже из общей лестницы, а не своей формулой.
    expect(src).toContain("termTotal(");
    // Прежняя арифметика: накопление итога вручную.
    expect(src).not.toMatch(/totalUsd\s*\+=/);
  });

  test("Конституция не имеет своей цены — она входит в каждый срок подписки (15.09.2026)", () => {
    // До 15.09 здесь сверялась цена Constitution Pro с ценой модуля: один товар —
    // одна цена. Теперь отдельной цены нет вовсе, и сторож держит, что вторая не
    // появится: ни таблицы тарифов Конституции, ни надстройки, ни отдельного приложения.
    const mod = MODULES_PRICING.find((m) => m.id === "constitution");
    expect(mod, "модуль constitution пропал из прайса — проверять нечего").toBeTruthy();
    expect(mod!.addonMonthly, "у Конституции снова своя цена надстройки").toBeNull();
    expect(standaloneApp("constitution"), "Конституция снова продаётся отдельным приложением").toBeNull();
    for (const t of TERM_TIERS) expect(mod!.includedIn, `Конституция не входит в срок ${t}`).toContain(t);
    expect(Object.keys(pricing), "таблица тарифов Конституции вернулась в прайс").not.toContain("CONSTITUTION_TIERS");
  });

  test("тарифы платформы читаются из прайса, а не из копий", () => {
    // Смысловая проверка: getTier — единственный вход к цене тарифа.
    for (const id of TERM_TIERS) {
      const t = getTier(id);
      expect(t?.priceMonthly, `${id} без цены`).toBeGreaterThan(0);
    }
  });

  test("три числа карточки срока описывают ОДНУ сделку", () => {
    // 13.08.2026 цены снизили, а «годовая цена в месяц» осталась считаться от
    // старых: год выглядел ДОРОЖЕ месяца. С 15.09.2026 у карточки три числа —
    // цена месяца, срок и платёж за срок, — и они обязаны сходиться.
    for (const id of TERM_TIERS) {
      const t = getTier(id)!;
      expect(t.termMonths, `${id}: срок в карточке не равен лестнице`).toBe(TERM_MONTHS[id]);
      expect(t.priceMonthly, `${id}: цена месяца не из лестницы`).toBe(termPricePerMonth(PLANET_BASE_MONTHLY, id));
      expect(
        t.priceTermTotal,
        `${id}: $${t.priceTermTotal} за срок — это не $${t.priceMonthly} × ${t.termMonths}`,
      ).toBe((t.priceMonthly as number) * (t.termMonths as number));
      // Прежние поля годовой цены убраны: их возвращение — вторая цена того же срока.
      expect(t, `${id}: вернулась годовая цена`).not.toHaveProperty("priceAnnualPerMonth");
      expect(t).not.toHaveProperty("priceAnnualTotal");
    }
  });

  test("шапка pricing.ts не пересказывает цены, а подпись лестницы равна тарифам", () => {
    // Комментарий — пересказ, и 13.08.2026 он разошёлся с делом: цены снизили,
    // а шапку не тронули. С 15.09.2026 шапка сознательно цен не называет
    // («числа живут только в TERM_* и PLANET_BASE_MONTHLY») — сторож держит это,
    // и сверяет единственный оставшийся пересказ: подпись у TERM_FACTOR.
    const src = readFileSync(join(__dirname, "..", "src", "data", "pricing.ts"), "utf8");
    const head = src.slice(0, src.indexOf("export type TierId"));
    expect(head.length, "шапка не найдена — сторож ослеп").toBeGreaterThan(200);

    const сЦеной = head.split("\n").filter((l) => /\$\s?\d/.test(l));
    expect(сЦеной, "в шапке снова пересказаны цены тарифов").toEqual([]);

    // Разбираем построчно, а не одной регуляркой по всему файлу.
    const подпись = src.split("\n").find((l) => l.includes("у планеты это"));
    expect(подпись, "подпись лестницы у TERM_FACTOR исчезла — сторож ослеп").toBeTruthy();
    const числа = ((подпись as string).match(/\d+/g) ?? []).map(Number);
    expect(числа, "подпись лестницы обещает не те цены месяца").toEqual(TERM_TIERS.map((t) => getTier(t)!.priceMonthly));
  });
});
