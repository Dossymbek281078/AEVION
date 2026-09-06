import { describe, test, expect, vi } from "vitest";
import { компактныйCustomId } from "../src/lib/payment/paypalProvider";

/**
 * Сторож: `custom_id` для PayPal всегда остаётся РАЗБИРАЕМЫМ.
 *
 * У PayPal это поле ограничено 127 символами. В коде стояла слепая обрезка
 * `JSON.stringify({...}).slice(0, 127)`, и пока внутрь ехали только ссылка и
 * один модуль (~80 символов), она была безвредной.
 *
 * 04.09.2026 я сам добавил туда места и СПИСОК модулей — и тем сделал
 * латентную мину живой. Замер: на шести модулях JSON занимает 131 символ,
 * после обрезки не разбирается, вебхук уходит в catch и получает обрезанный
 * мусор ВМЕСТО ССЫЛКИ. А из ссылки выводится ТАРИФ. То есть покупка с
 * шестью модулями провижинилась бы неверно.
 *
 * Охраняется главное: что бы ни положили внутрь, на выходе валидный JSON,
 * укладывающийся в предел, и `reference` цел. Терять можно модули и места —
 * ссылку нельзя.
 */
const ПРЕДЕЛ = 127;
const REF = "tier_lite_monthly";

describe("custom_id для PayPal остаётся разбираемым", () => {
  test("КОНТРОЛЬ: маленькая нагрузка проходит целиком", () => {
    // Без контроля «влезает» удовлетворялось бы кодом, который выбрасывает
    // всё подряд и всегда отдаёт одну ссылку.
    const j = компактныйCustomId(REF, { module: "qsign", seats: "2" });
    const o = JSON.parse(j);
    expect(o.reference).toBe(REF);
    expect(o.module, "выброшено то, что спокойно влезало").toBe("qsign");
    expect(o.seats).toBe("2");
  });

  test("шесть модулей: результат влезает и разбирается, ссылка цела", () => {
    const modules = "qsign,qright,healthai,aevion-ip-bureau,qcoreai,qcontract";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const j = компактныйCustomId(REF, { module: "qsign", seats: "5", modules });
    expect(j.length, `не влез в предел: ${j.length}`).toBeLessThanOrEqual(ПРЕДЕЛ);
    const o = JSON.parse(j); // упадёт, если обрезали посимвольно
    expect(o.reference, "потеряна ссылка — а из неё выводится ТАРИФ").toBe(REF);
  });

  test("двадцать модулей — тоже валидный JSON с целой ссылкой", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const modules = Array.from({ length: 20 }, (_v, i) => `module-number-${i}`).join(",");
    const j = компактныйCustomId(REF, { module: "qsign", seats: "1000", modules });
    expect(j.length).toBeLessThanOrEqual(ПРЕДЕЛ);
    expect(JSON.parse(j).reference).toBe(REF);
  });

  test("аномально длинная ссылка не рождает мусор", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const j = компактныйCustomId("t".repeat(300), { module: "qsign" });
    expect(j.length).toBeLessThanOrEqual(ПРЕДЕЛ);
    expect(() => JSON.parse(j), "на выходе не JSON").not.toThrow();
  });

  test("потеря не молчаливая — в журнал уходит, ЧТО отброшено", () => {
    const журнал: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((m: unknown) => {
      журнал.push(String(m));
    });
    компактныйCustomId(REF, {
      module: "qsign",
      seats: "5",
      modules: "qsign,qright,healthai,aevion-ip-bureau,qcoreai,qcontract",
    });
    expect(журнал.join(" "), "оплаченное отброшено молча").toMatch(/отброшено/);
  });
});
