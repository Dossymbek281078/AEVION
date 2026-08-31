import { describe, it, expect } from "vitest";
import { isSmokeSlot, countSmokeSlots } from "./slotSource";
import { readFileSync } from "node:fs";
import path from "node:path";
import { allTranslations } from "../__tests__/localeSource";

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

  it("флаг сервера главнее собственного разбора", () => {
    // Сервер считает то же самое (`lib/slotOrigin.ts`) и является источником
    // правды; свой разбор нужен лишь пока прод не выкачен.
    expect(isSmokeSlot({ routeId: "smoke-route-1", holder: "op0", test: false })).toBe(false);
    expect(isSmokeSlot({ routeId: "route-astana-h1-h2", holder: "человек", test: true })).toBe(true);
  });

  it("на выборке с прода считается 3 из 4", () => {
    expect(countSmokeSlots(PROD_SAMPLE)).toBe(3);
    expect(countSmokeSlots([])).toBe(0);
  });

  it("демо-кнопка страницы помечается тестовой", () => {
    expect(isSmokeSlot({ routeId: "astana-vp-112_2", holder: "AEVION demo" })).toBe(true);
    expect(isSmokeSlot({ routeId: "astana-vp-112_2", holder: "AEVION Logistics" })).toBe(false);
    expect(countSmokeSlots([
      { routeId: "astana-vp-112_2", holder: "AEVION demo" },
      { routeId: "astana-vp-112_2", holder: "aero-taxi-kz" },
    ])).toBe(1);
  });
});

/**
 * Литерал берётся ИЗ СТРАНИЦЫ, а не из копии в тесте.
 *
 * ПОВОД. Проверка выше закрепляет строку "AEVION demo", которую я вписал в
 * тест руками. Это КОПИЯ значения, а не связь с ним: поменяют подпись в
 * `_client.tsx` на «AEVION Demo Flight» — тест останется зелёным, а демо-брони
 * снова начнут считаться живым спросом. Ровно тот дефект, ради которого
 * классификация и заводилась.
 *
 * Поэтому читаем то, что страница РЕАЛЬНО отправляет.
 */
describe("демо-держатель связан со страницей, а не скопирован", () => {
  const SRC = readFileSync(
    path.join(__dirname, "_client.tsx"),
    "utf8",
  );

  it("страница шлёт holder, и он классифицируется как не живой спрос", () => {
    const m = SRC.match(/holder:\s*"([^"]+)"/);
    expect(m, "страница больше не шлёт holder литералом — проверку надо переписать").toBeTruthy();
    const sent = String(m![1]);
    expect(
      isSmokeSlot({ routeId: "astana-vp-112_2", holder: sent }),
      "страница шлёт holder=" + JSON.stringify(sent) + ", а классификация считает это живой бронью",
    ).toBe(true);
  });
});

/**
 * Подпись кнопки называет то, что кнопка делает.
 *
 * ПОВОД. Кнопка говорила «Забронировать слот (QRight)» — ни слова о
 * демонстрации. Нажатие создаёт НАСТОЯЩУЮ запись в боевой базе, подписанную
 * зашитым `holder`, и про демо человек узнавал только ПОСЛЕ клика, из
 * сообщения об успехе. Я сам так создал две настоящие брони, пока проходил
 * страницу глазами.
 *
 * Это та же нечестность, что и в статусе якоря, только со стороны человека:
 * действие описано мягче, чем оно есть. Здесь проверяем связь — если страница
 * шлёт демо-держателя, подпись обязана говорить «демо».
 */
describe("кнопка брони не обещает больше, чем делает", () => {
  const SRC2 = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("страница шлёт демо-держателя — значит подпись говорит про демо", () => {
    const m = SRC2.match(/holder:\s*"([^"]+)"/);
    expect(m, "страница больше не шлёт holder литералом").toBeTruthy();
    const sent = String(m![1]).toLowerCase();
    // Проверка нужна, только пока бронь демонстрационная. Появится настоящая —
    // условие снимется само, и тест не будет мешать.
    if (!sent.includes("demo")) return;

    for (const lang of ["ru", "en", "kk"] as const) {
      const dicts = allTranslations() as Record<string, Record<string, string>>;
      const label = String(dicts[lang]?.["qskyway.btn.bookSlot"] ?? "");
      expect(label.length, "подпись кнопки пропала в " + lang).toBeGreaterThan(0);
      expect(
        /demo|демо/i.test(label),
        "в " + lang + " подпись «" + label + "» не говорит, что бронь демонстрационная",
      ).toBe(true);
    }
  });
});
