import { describe, it, expect } from "vitest";
import { isSmokeSlot, countLiveSlots } from "../src/lib/slotOrigin";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Живой aevion.app 10.08.2026: `GET /api/qskyway/slots` → count 34, и 33 из них
// оставлены нашим же прод-смоком (`smoke-route-…`, держатели op0..op3 / late /
// verify / smoke-holder). Он бронирует 5–6 слотов каждый прогон и за собой не
// убирает, так что число росло бы вечно, а страница выдавала бы его за глубину
// рынка. Записи не удаляем — право там настоящее; отделяем.

/** Выборка взята с прода как есть, не сочинена. */
const PROD_SAMPLE = [
  { id: "slot-b45e5768", routeId: "smoke-route-persist-1", holder: "smoke-holder" },
  { id: "slot-fee655cc", routeId: "smoke-route-1784717297420-f5f6in", holder: "late" },
  { id: "slot-67cfbaf7", routeId: "smoke-route-1784717297420-f5f6in", holder: "op3" },
  { id: "slot-real", routeId: "route-astana-h1-h2", holder: "operator@example.com" },
];

describe("происхождение брони: смок или человек", () => {
  it("маршрут смока распознаётся, регистр не мешает", () => {
    expect(isSmokeSlot({ routeId: "smoke-route-persist-1" })).toBe(true);
    expect(isSmokeSlot({ routeId: "SMOKE-route-2" })).toBe(true);
    expect(isSmokeSlot({ routeId: "qskyway-smoke-route-9" })).toBe(true);
  });

  it("держатели смоук-сценариев распознаются и при обычном маршруте", () => {
    for (const holder of ["op0", "op3", "late", "verify", "smoke-holder", "h2"]) {
      expect(isSmokeSlot({ routeId: "route-astana-h1-h2", holder }), holder).toBe(true);
    }
  });

  it("настоящая бронь тестовой не считается", () => {
    expect(isSmokeSlot({ routeId: "route-nyc-h3-h5", holder: "aero-taxi-kz" })).toBe(false);
    expect(isSmokeSlot({})).toBe(false);
    expect(isSmokeSlot({ routeId: null, holder: null })).toBe(false);
  });

  it("живая глубина рынка на прод-выборке — 1 из 4", () => {
    expect(countLiveSlots(PROD_SAMPLE)).toBe(1);
    expect(countLiveSlots([])).toBe(0);
  });

  it("демо-кнопка самой страницы не считается рынком", () => {
    // Публичная страница шлёт зашитый holder "AEVION demo" — поля имени там нет.
    // Клик посетителя не должен публиковаться как заявка оператора.
    expect(isSmokeSlot({ routeId: "astana-vp-112_2", holder: "AEVION demo" })).toBe(true);
    expect(isSmokeSlot({ routeId: "astana-vp-112_2", holder: "aevion demo" })).toBe(true);
    // Соседний контроль: похожее, но НЕ демо-имя остаётся живым.
    expect(isSmokeSlot({ routeId: "astana-vp-112_2", holder: "AEVION Logistics" })).toBe(false);
    expect(countLiveSlots([
      { routeId: "astana-vp-112_2", holder: "AEVION demo" },
      { routeId: "astana-vp-112_2", holder: "aero-taxi-kz" },
    ])).toBe(1);
  });
});

/**
 * Литерал держателя берётся ИЗ СТРАНИЦЫ, а не копируется в тест.
 *
 * ПОВОД. Проверка выше закрепляет строку "AEVION demo", вписанную руками. Это
 * копия значения, а не связь: поменяют подпись в `_client.tsx` — тест
 * останется зелёным, а демо-брони снова начнут считаться живым спросом. Ровно
 * тот дефект, ради которого классификация и заводилась.
 *
 * ⚠️ Да, тест бэкенда читает файл фронта — граница пересечена НАМЕРЕННО.
 * Знание («чем подписывается демо-бронь») и так живёт в двух местах; пока это
 * так, лучше пусть связь будет видимой и проверяемой, чем невидимой. Если
 * страница переедет, тест скажет об этом прямо, а не промолчит.
 */
const CLIENT = path.join(
  __dirname, "..", "..", "frontend", "src", "app", "qskyway", "_client.tsx",
);

describe("демо-держатель бэкенда связан со страницей", () => {
  it("страница на месте — иначе связь надо переписать, а не удалять", () => {
    expect(
      existsSync(CLIENT),
      "не нашёл " + CLIENT + ": страница переехала, поправьте путь в этом тесте",
    ).toBe(true);
  });

  it("то, что страница РЕАЛЬНО шлёт, классифицируется как не живой спрос", () => {
    const src = readFileSync(CLIENT, "utf8");
    const m = src.match(/holder:\s*"([^"]+)"/);
    expect(m, "страница больше не шлёт holder литералом — проверку надо переписать").toBeTruthy();
    const sent = String(m![1]);
    expect(
      isSmokeSlot({ routeId: "astana-vp-112_2", holder: sent }),
      "страница шлёт holder=" + JSON.stringify(sent) + ", а бэкенд считает это живой бронью",
    ).toBe(true);
  });
});
