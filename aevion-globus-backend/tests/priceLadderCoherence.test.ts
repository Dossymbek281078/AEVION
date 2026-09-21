import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  TIERS, MODULES_PRICING, BUNDLES, getTier, getModulePrice,
  TERM_TIERS, STANDALONE_APPS, termTotal, termPricePerMonth, PLANET_BASE_MONTHLY,
} from "../src/data/pricing";
import { priceForReference } from "../src/data/lemonSqueezyVariants";

/**
 * Лестница цен обязана быть выбираемой: у покупателя не должно быть варианта,
 * который хуже другого по всем признакам сразу.
 *
 * 13.08.2026 тарифы снизили, а цены модулей и сборок остались от старой лестницы,
 * и 14.08 замер показал, во что это превратилось: сборка давала меньше за больше,
 * обещанная скидка оказалась наценкой, модуль стоил как вся платформа, а пять
 * модулей стоили в прайсе одно, а в кассе другое. Ни один случай не падал — они
 * просто тихо стояли на сайте. Поэтому проверка смысловая, а не арифметическая.
 *
 * С 15.09.2026 лестница другая: тариф — это СРОК доступа ко всей планете, наборов
 * нет вовсе, а отдельно продаются пять приложений по той же лестнице сроков.
 * Непротиворечивость теперь означает: длинный срок дешевле в месяц и дороже за
 * срок; отдельное приложение не дороже подписки, которая его включает; и цена
 * приложения одна в прайсе, в кассе и на витрине.
 */

const FRONT_PRODUCTS = join(__dirname, "..", "..", "frontend", "src", "lib", "products.ts");
const FRONT_TERMS = join(__dirname, "..", "..", "frontend", "src", "lib", "termPricing.ts");

/** Базы приложений, объявленные на витрине сайта (её собственный источник цен). */
function витринныеБазы(): Map<string, number> {
  const out = new Map<string, number>();
  if (!existsSync(FRONT_TERMS)) return out;
  const src = readFileSync(FRONT_TERMS, "utf8");
  for (const m of src.matchAll(/moduleId:\s*"([^"]+)"[^}]*baseMonthly:\s*([\d.]+)/g)) {
    out.set(m[1], Number(m[2]));
  }
  return out;
}

const FULL = getTier("full")?.priceMonthly ?? 0;

describe("лестница цен непротиворечива", () => {
  test("контроль: тарифы, модули и лестница вообще прочитались", () => {
    // Пустые списки дали бы зелёный на любом состоянии прайса.
    expect(TIERS.length).toBeGreaterThan(3);
    expect(MODULES_PRICING.length).toBeGreaterThan(10);
    expect(TERM_TIERS.length).toBe(5);
    expect(STANDALONE_APPS.length).toBe(9);
    expect(FULL).toBeGreaterThan(0);
  });

  test("длиннее срок — дешевле месяц и дороже платёж за срок", () => {
    // Иначе лестница становится невыбираемой: ступень, которая дороже в месяц И
    // короче, не купит никто, а ступень дешевле по всем признакам обесценит соседние.
    let прошлыйМесяц = Infinity;
    let прошлыйИтог = 0;
    for (const t of TERM_TIERS) {
      const tier = getTier(t)!;
      expect(tier.priceMonthly!, `${t}: месяц не дешевеет с длиной срока`).toBeLessThan(прошлыйМесяц);
      expect(tier.priceTermTotal!, `${t}: платёж за срок не растёт`).toBeGreaterThan(прошлыйИтог);
      прошлыйМесяц = tier.priceMonthly!;
      прошлыйИтог = tier.priceTermTotal!;
    }
  });

  /**
   * Известные расхождения, которые НЕЛЬЗЯ починить кодом: цена живёт в кабинете
   * кассы, менять её — рука основателя. Держим поимённо и с тем, что должно
   * произойти, иначе сторож стал бы вечно красным и его перестали бы читать.
   *
   * 15.09.2026: пусто — прежние случаи (smeta-trainer, qrenew дороже тарифа,
   * который их включает) ушли вместе с отдельными ценами этих модулей.
   */
  const AWAITING_FOUNDER: Record<string, string> = {};

  test("модуль не дороже самого дешёвого тарифа, который его включает", () => {
    const cheapestTierPrice = (ids: readonly string[]) =>
      ids
        .map((id) => getTier(id)?.priceMonthly)
        .filter((p): p is number => typeof p === "number" && p > 0)
        .sort((a, b) => a - b)[0];

    const over: string[] = [];
    for (const m of MODULES_PRICING) {
      const addon = m.addonMonthly;
      if (typeof addon !== "number") continue;
      const tierPrice = cheapestTierPrice(m.includedIn ?? []);
      if (!tierPrice || addon < tierPrice) continue;
      const line = `${m.id} $${addon} ≥ тариф $${tierPrice}, который его уже включает`;
      if (AWAITING_FOUNDER[m.id]) continue;
      over.push(line);
    }

    expect(over, `модуль отдельно дороже тарифа с ним внутри: ${over.join(", ")}`).toEqual([]);
  });

  test("список «ждёт основателя» не протух — каждый случай ещё настоящий", () => {
    // Исключение, которое уже неверно, опаснее отсутствия проверки: оно молча
    // разрешает то, что давно починили.
    const stale: string[] = [];
    for (const id of Object.keys(AWAITING_FOUNDER)) {
      const m = MODULES_PRICING.find((x) => x.id === id);
      if (!m || typeof m.addonMonthly !== "number") {
        stale.push(`${id}: модуля или его цены больше нет`);
        continue;
      }
      const tierPrice = (m.includedIn ?? [])
        .map((t) => getTier(t)?.priceMonthly)
        .filter((p): p is number => typeof p === "number" && p > 0)
        .sort((a, b) => a - b)[0];
      if (tierPrice && (m.addonMonthly as number) < tierPrice) {
        stale.push(`${id}: расхождение устранено — уберите из AWAITING_FOUNDER`);
      }
    }

    expect(stale, stale.join("; ")).toEqual([]);
  });

  test("наборов модулей нет: набор стал бы третьей ценой того же доступа", () => {
    // Прежде здесь проверялось, что набор не дороже тарифа и что обещанная скидка
    // настоящая. 15.09.2026 наборы сняты: любой платный срок открывает все модули.
    // Вернётся набор — вернутся и обе проверки вместе с этой.
    expect(BUNDLES, "наборы вернулись в прайс — это третья цена одного и того же доступа").toEqual([]);
  });

  test("отдельное приложение дешевле всей планеты на том же сроке", () => {
    // Приложение дороже планеты — вариант, который не выберет никто: за те же
    // деньги человек взял бы всю планету. Сумму ПЯТИ приложений здесь намеренно
    // не сравниваем: после снижения базы IP Bureau до $32 (15.09.2026) пять
    // приложений стоят $376/мес против $400 у планеты — это осознанное решение
    // основателя, и охраняет его termPricingLadder (там сумма закреплена числом).
    for (const a of STANDALONE_APPS) {
      for (const t of TERM_TIERS) {
        expect(
          termTotal(a.baseMonthly, t),
          `${a.slug}/${t}: приложение стоит как вся планета или дороже — брать его незачем`,
        ).toBeLessThan(getTier(t)!.priceTermTotal!);
      }
    }
  });

  test("цена приложения одна: прайс, касса и лестница сроков", () => {
    for (const a of STANDALONE_APPS) {
      const прайс = getModulePrice(a.moduleId)?.addonMonthly;
      if (typeof прайс === "number") {
        expect(прайс, `${a.slug}: цена надстройки в прайсе не равна базе лестницы`).toBe(a.baseMonthly);
      }
      for (const t of TERM_TIERS) {
        expect(
          priceForReference(`app_${a.slug}_${t}`),
          `${a.slug}/${t}: касса возьмёт не платёж за срок по базе приложения`,
        ).toBe(termPricePerMonth(a.baseMonthly, t) * (getTier(t)!.termMonths as number));
      }
    }
    // Контроль: у планеты своя база, и она не равна базе приложения — иначе
    // сравнение выше проходило бы на любых числах.
    expect(PLANET_BASE_MONTHLY).not.toBe(STANDALONE_APPS[0].baseMonthly);
  });

  test("цена приложения на витрине сайта равна той, что спишет касса", () => {
    const витрина = витринныеБазы();
    expect(витрина.size, "базы витрины не прочитались — сторож ослеп").toBeGreaterThanOrEqual(STANDALONE_APPS.length);

    const diff: string[] = [];
    for (const a of STANDALONE_APPS) {
      const наВитрине = витрина.get(a.moduleId);
      if (наВитрине === undefined) {
        diff.push(`${a.moduleId}: на витрине нет базы цены`);
        continue;
      }
      if (Math.abs(наВитрине - a.baseMonthly) > 0.01) {
        diff.push(`${a.moduleId}: витрина $${наВитрине}, касса $${a.baseMonthly}`);
      }
    }

    expect(diff, `страница покажет одно, а спишется другое: ${diff.join("; ")}`).toEqual([]);
  });

  test("в каталоге магазина цена приложения не вписана числом", () => {
    // Вписанное число — второй источник цены: он разойдётся с лестницей молча.
    if (!existsSync(FRONT_PRODUCTS)) return;
    const src = readFileSync(FRONT_PRODUCTS, "utf8");
    const куски = src.split('    id: "').slice(1);
    const свои: string[] = [];
    for (const кусок of куски) {
      const тело = кусок.slice(0, 900);
      if (!тело.includes('kind: "module"')) continue;
      const цена = /priceUsd:\s*([^\n,]+)/.exec(тело)?.[1]?.trim() ?? "";
      if (/^[\d.]+$/.test(цена)) свои.push(`${кусок.slice(0, кусок.indexOf('"'))}: priceUsd ${цена}`);
    }
    expect(свои, `цена приложения вписана числом вместо базы лестницы: ${свои.join(", ")}`).toEqual([]);
  });
});
