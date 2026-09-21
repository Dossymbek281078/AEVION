import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { PLANET_BASE_MONTHLY, STANDALONE_APPS } from "@/lib/termPricing";

/**
 * Ручка сайта печатает СВОЮ вкомпилированную копию цен — по ней снаружи видно,
 * что половины платформы разошлись (20.09.2026: бэкенд $16, сайт $28 полчаса).
 * Убрать поле правкой одного файла легко, поэтому оно закреплено тестом.
 */
describe("сайт называет свою копию лестницы цен", () => {
  it("в ответе есть база планеты и базы ВСЕХ приложений", async () => {
    const r = GET();
    const j = (await r.json()) as { pricing?: { planetBaseMonthly?: number; apps?: Record<string, number> } };
    expect(j.pricing, "поля pricing нет — расхождение половин снова станет невидимым").toBeTruthy();
    expect(j.pricing!.planetBaseMonthly).toBe(PLANET_BASE_MONTHLY);
    for (const a of STANDALONE_APPS) {
      expect(j.pricing!.apps?.[a.slug], `${a.slug} не назван в ответе`).toBe(a.baseMonthly);
    }
    // КОНТРОЛЬ прибора: приложений вообще несколько, иначе цикл выше пуст и
    // проверка проходила бы на любом ответе.
    expect(STANDALONE_APPS.length).toBeGreaterThanOrEqual(5);
  });
});
