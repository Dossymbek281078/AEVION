import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { entitlementsRouter, minUnlockPriceUsd } from "../src/routes/entitlements";
import { MODULES_PRICING, TIERS } from "../src/data/pricing";
import { appSlugForModuleId } from "../src/data/lemonSqueezyVariants";

/**
 * «Самая дешёвая разблокировка» считается по ВСЕМ путям, которые можно
 * купить, а не по одним тарифам.
 *
 * ЗАЧЕМ. Это число умножается на количество отказов и даёт `mrrCeilingUsd` —
 * «сколько денег на столе». По нему решают, что чинить и что продвигать.
 * Считалось оно по одним тарифам, хотя у модуля есть второй путь — добавка.
 *
 * Замер на живых данных прода (02.09.2026): 10 196 отказов всего, и у
 * `constitution` добавка $9 против дешевейшего тарифа $49 — потолок по этому
 * модулю завышался в 5.4 раза.
 *
 * ГРАНИЦА. Добавка учитывается только там, где у неё ЕСТЬ касса: цена
 * добавки объявлена у 31 модуля, а ссылка варианта (`app_<id>`) есть у 8.
 * Иначе мы занижали бы потолок обещанием, которое не выполняем, — и это
 * ошибка в другую сторону, но такая же.
 */

function app() {
  const a = express();
  a.use("/api", entitlementsRouter);
  return a;
}

describe("цена разблокировки — минимум по покупаемым путям", () => {
  it("контроль: политика вообще отвечает и знает модули", async () => {
    // Без этого проверки ниже могли бы проходить на пустом ответе.
    const r = await request(app()).get("/api/paywall/policy");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.modules)).toBe(true);
    expect(r.body.modules.length, "список модулей пуст — сравнивать нечего").toBeGreaterThan(10);
  });

  it("у модуля с ПОКУПАЕМОЙ добавкой дешевле её цена, а не тарифная", () => {
    // Берём предмет по данным, а не по имени: любой модуль, у которого есть
    // касса добавки и добавка дешевле дешевейшего тарифа.
    const tierPrice = new Map<string, number | null>(TIERS.map((t) => [t.id, t.priceMonthly]));
    const кандидаты = MODULES_PRICING.filter((m) => {
      if (!appSlugForModuleId(m.id)) return false;
      const a = m.addonMonthly;
      if (typeof a !== "number" || a <= 0) return false;
      const цены = (m.includedIn ?? [])
        .map((t: string) => tierPrice.get(t))
        .filter((p): p is number => typeof p === "number" && p > 0);
      return цены.length > 0 && a < Math.min(...цены);
    });

    expect(
      кандидаты.length,
      "в данных не осталось ни одного такого модуля — проверка стала пустой, " +
        "перечитайте замер, а не удаляйте тест",
    ).toBeGreaterThan(0);

    // Утверждение о СВОЙСТВЕ, а не о числе: цены меняются, правило нет.
    //
    // ⚠️ Первая редакция этого теста проверяла только ДАННЫЕ (что такие
    // модули есть) и мутацию «добавка снова не учитывается» НЕ ловила —
    // то есть охраняла пустоту. Проверено мутацией, а не чтением; поэтому
    // функция теперь экспортируется и утверждение делается о НЕЙ.
    for (const m of кандидаты) {
      expect(
        minUnlockPriceUsd(m.id),
        `${m.id}: взята цена тарифа, хотя добавку за $${m.addonMonthly} можно купить — ` +
          "потолок выручки по этому модулю завышен",
      ).toBe(m.addonMonthly);
    }
  });

  it("объявленная цена добавки есть ТОЛЬКО у модулей с кассой (15.09.2026)", () => {
    // Обратная сторона: занижать потолок обещанием, которого мы не выполняем, —
    // такая же ошибка, только в другую сторону. Раньше таких модулей было 23 из 31,
    // и граница проверялась на них. Теперь цена добавки объявлена ровно у
    // приложений, которые продаются отдельно, — значит проверять надо это:
    // появится цена без кассы, и потолок снова занизится молча.
    const безКассы = MODULES_PRICING.filter(
      (m) => !appSlugForModuleId(m.id) && typeof m.addonMonthly === "number" && m.addonMonthly > 0,
    ).map((m) => m.id);
    expect(
      безКассы,
      "у модуля объявлена цена добавки, а купить её нельзя: потолок выручки занижен обещанием",
    ).toEqual([]);
  });

  it("у модуля БЕЗ добавки берётся цена самого дешёвого срока, который его включает", () => {
    // Контроль второго рода к тесту выше: функция обязана уметь отвечать и там, где
    // добавки нет вовсе, — иначе «минимум по путям» выродился бы в «всегда добавка».
    const tierPrice = new Map<string, number | null>(TIERS.map((t) => [t.id, t.priceMonthly]));
    const без = MODULES_PRICING.filter(
      (m) => m.addonMonthly === null && !m.includedIn.includes("free") && m.includedIn.some((t) => (tierPrice.get(t) ?? 0) > 0),
    );
    expect(без.length, "нет модулей без добавки — проверка стала пустой").toBeGreaterThan(0);

    for (const m of без.slice(0, 5)) {
      const дешевейший = Math.min(
        ...m.includedIn.map((t) => tierPrice.get(t)).filter((p): p is number => typeof p === "number" && p > 0),
      );
      expect(minUnlockPriceUsd(m.id), `${m.id}: взята не цена дешевейшего срока`).toBe(дешевейший);
    }
  });
});
