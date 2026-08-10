import { describe, it, expect } from "vitest";
import { isSmokeSlot, countSmokeSlots } from "./slotSource";

// Живой aevion.app 10.08.2026: «Рынок 4D-слотов (QRight) · 34», и 33 из них —
// вывод смоук-набора (`smoke-route-…`, держатели op0..op3 / late / verify /
// smoke-holder). Квитанции настоящие, отличить рыночную бронь от тестовой было
// нечем. Проверено прямым запросом к прод-API, а не по виду страницы.

const PROD_SAMPLE = [
  { id: "slot-b45e5768", routeId: "smoke-route-persist-1", holder: "smoke-holder" },
  { id: "slot-fee655cc", routeId: "smoke-route-1784717297420-f5f6in", holder: "late" },
  { id: "slot-67cfbaf7", routeId: "smoke-route-1784717297420-f5f6in", holder: "op3" },
  { id: "slot-real", routeId: "route-astana-h1-h2", holder: "operator@example.com" },
];

describe("тестовая бронь отличается от настоящей", () => {
  it("маршрут смока распознаётся", () => {
    expect(isSmokeSlot({ routeId: "smoke-route-persist-1", holder: "кто-то" })).toBe(true);
    expect(isSmokeSlot({ routeId: "SMOKE-route-2", holder: "кто-то" })).toBe(true);
    expect(isSmokeSlot({ routeId: "qskyway-smoke-route-9", holder: "кто-то" })).toBe(true);
  });

  it("держатели смоук-сценариев распознаются даже при обычном маршруте", () => {
    for (const holder of ["op0", "op3", "late", "verify", "smoke-holder", "h2"]) {
      expect(isSmokeSlot({ routeId: "route-astana-h1-h2", holder }), holder).toBe(true);
    }
  });

  it("настоящая бронь тестовой не считается", () => {
    expect(isSmokeSlot({ routeId: "route-astana-h1-h2", holder: "operator@example.com" })).toBe(false);
    expect(isSmokeSlot({ routeId: "route-nyc-h3-h5", holder: "aero-taxi-kz" })).toBe(false);
  });

  it("пустые поля не роняют и не помечают", () => {
    expect(isSmokeSlot({})).toBe(false);
    expect(isSmokeSlot({ routeId: "", holder: "" })).toBe(false);
  });

  it("на выборке с прода считается 3 из 4", () => {
    expect(countSmokeSlots(PROD_SAMPLE)).toBe(3);
    expect(countSmokeSlots([])).toBe(0);
  });
});
