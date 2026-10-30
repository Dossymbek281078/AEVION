import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { PLANET_BASE_MONTHLY, PLANET_TERM_PRICE, STANDALONE_APPS, CHESS_YEARLY_USD } from "@/lib/termPricing";
import { НЕ_ПРОДАЁТСЯ_ОТДЕЛЬНО, predlagaemOtdelno } from "@/lib/neProdayotsyaOtdelno";

/**
 * Ручка сайта печатает СВОЮ вкомпилированную копию цен — по ней снаружи видно,
 * что половины платформы разошлись (20.09.2026: бэкенд $16, сайт $28 полчаса).
 * Убрать поле правкой одного файла легко, поэтому оно закреплено тестом.
 *
 * С 19.10.2026 цена опубликована так: лестница Планеты и ТОЛЬКО отдельно
 * продаваемые приложения (шахматы $50/год). Отменённых баз модулей в ответе нет.
 */
type Pricing = {
  planetBaseMonthly?: number;
  plan?: Record<string, number>;
  apps?: Record<string, { yearUsd?: number; baseMonthly?: number }>;
};

describe("сайт называет свою копию цен", () => {
  it("в ответе есть цена Планеты и все отдельно продаваемые приложения, отменённых баз нет", async () => {
    const r = GET();
    const j = (await r.json()) as { pricing?: Pricing };
    expect(j.pricing, "поля pricing нет — расхождение половин снова станет невидимым").toBeTruthy();
    expect(j.pricing!.planetBaseMonthly).toBe(PLANET_BASE_MONTHLY);
    expect(j.pricing!.plan).toEqual(PLANET_TERM_PRICE);
    expect(j.pricing!.plan).toEqual({ lite: 250, medium: 225, pro: 200, full: 175, max: 150 });

    const продаются = STANDALONE_APPS.filter((a) => predlagaemOtdelno(a.slug));
    // КОНТРОЛЬ прибора: отдельно продаётся хотя бы шахматы, иначе цикл пуст.
    expect(продаются.map((a) => a.slug)).toContain("cyberchess");
    for (const a of продаются) {
      expect(j.pricing!.apps?.[a.slug], `${a.slug} продаётся отдельно, но не назван в ответе`).toBeTruthy();
    }
    expect(j.pricing!.apps!.cyberchess.yearUsd).toBe(CHESS_YEARLY_USD);

    for (const slug of Object.keys(НЕ_ПРОДАЁТСЯ_ОТДЕЛЬНО)) {
      expect(j.pricing!.apps, `${slug}: цена отменена, в ответе её быть не должно`).not.toHaveProperty(slug);
    }
    expect(Object.keys(j.pricing!.apps!).sort()).toEqual(продаются.map((a) => a.slug).sort());
  });
});
