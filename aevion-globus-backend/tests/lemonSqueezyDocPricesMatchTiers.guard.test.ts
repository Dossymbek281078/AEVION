import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TIERS, TERM_TIERS, TERM_MONTHS, TERM_NAME, STANDALONE_APPS, termTotal } from "../src/data/pricing";
import { priceForReference, STOREFRONT_NAME_TO_REFERENCE } from "../src/data/lemonSqueezyVariants";

/**
 * Сторож: ИНСТРУКЦИЯ по настройке кассы не расходится с тарифами.
 *
 * Повод (29.08.2026). В шапке lemonSqueezyVariants.ts лежало указание человеку:
 * завести в Lemon Squeezy варианты по $24/$39/$89 — цены от 22.07, давно
 * сменённые. Настроивший кассу по инструкции списывал бы с покупателя БОЛЬШЕ, чем
 * обещает витрина.
 *
 * С 15.09.2026 инструкция не пересказывает цены: она велит завести вариант
 * «каждые N месяцев» с ценой ЗА ВЕСЬ СРОК, равной priceForReference, а товары
 * называть ровно как в STOREFRONT_NAME_TO_REFERENCE. Поэтому сторож держит три
 * вещи, по которым человек делает денежное действие руками:
 *   • сроки в инструкции равны лестнице (TERM_MONTHS);
 *   • в инструкции нет долларовых сумм — пересказ цены стареет молча;
 *   • priceForReference, на который она ссылается, даёт платёж за срок тарифа и
 *     приложения, а названия товаров несут тот же срок в месяцах.
 */
const ФАЙЛ = join(__dirname, "..", "src", "data", "lemonSqueezyVariants.ts");
const текст = readFileSync(ФАЙЛ, "utf8");
const шапка = текст.slice(0, текст.indexOf("import "));

describe("инструкция по настройке кассы не расходится с тарифами", () => {
  it("контроль: шапка с инструкцией прочиталась", () => {
    expect(шапка.length, "шапка файла пуста — сторож ослеп").toBeGreaterThan(200);
    expect(шапка).toContain("priceForReference");
  });

  it("сроки ступеней в инструкции равны лестнице", () => {
    const m = /lite (\d+) мес, medium (\d+), pro (\d+), full (\d+), max (\d+)/.exec(шапка);
    expect(m, "строка со сроками ступеней исчезла из инструкции").not.toBeNull();
    expect(m!.slice(1).map(Number), "инструкция велит завести не тот интервал подписки").toEqual(
      TERM_TIERS.map((t) => TERM_MONTHS[t]),
    );
  });

  it("инструкция не называет долларовых цен — их источник один", () => {
    const строки = шапка.split(String.fromCharCode(10)).filter((l) => /\$\s?\d/.test(l));
    expect(строки, "в инструкции снова пересказаны цены — они разойдутся с тарифами").toEqual([]);
  });

  it("цена варианта планеты = платёж за срок тарифа", () => {
    for (const t of TERM_TIERS) {
      const tier = TIERS.find((x) => x.id === t)!;
      expect(priceForReference(`tier_${t}`), `tier_${t}: касса и тариф разошлись`).toBe(tier.priceTermTotal);
    }
  });

  it("цена варианта приложения = платёж за срок по базе приложения", () => {
    for (const a of STANDALONE_APPS) {
      for (const t of TERM_TIERS) {
        expect(priceForReference(`app_${a.slug}_${t}`), `app_${a.slug}_${t}`).toBe(termTotal(a.baseMonthly, t));
      }
    }
  });

  it("название товара на витрине несёт срок ступени в месяцах", () => {
    const имена = Object.entries(STOREFRONT_NAME_TO_REFERENCE);
    expect(имена.length).toBe(TERM_TIERS.length * (1 + STANDALONE_APPS.length));
    for (const [имя, ref] of имена) {
      const ступень = ref.slice(ref.lastIndexOf("_") + 1) as (typeof TERM_TIERS)[number];
      expect(имя, `${ref}: название товара не называет ступень`).toContain(`— ${TERM_NAME[ступень]} (`);
      expect(имя, `${ref}: название товара называет не тот срок`).toContain(`(${TERM_MONTHS[ступень]} mo)`);
    }
  });
});
