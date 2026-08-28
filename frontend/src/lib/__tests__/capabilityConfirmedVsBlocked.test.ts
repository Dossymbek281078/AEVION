import { describe, test, expect } from "vitest";
import { isCapabilityBlocked, isCapabilityConfirmed, indexCapabilities } from "../devhubCapabilities";

/**
 * Два вопроса с ПРОТИВОПОЛОЖНЫМИ умолчаниями на незнании.
 *
 * «Блокировать кнопку?» на незнании отвечает НЕТ: иначе человек упрётся в
 * мёртвую кнопку из-за нашей незагруженной панели.
 *
 * «Обещать вслух?» на незнании отвечает НЕТ по другой причине: обещание,
 * которое через секунду исчезнет, хуже отсутствия обещания. Замер 28.08.2026:
 * обещание собственного домена *.aevion.build показывалось до загрузки
 * возможностей, а зона не делегирована и адрес не открылся бы.
 */

describe("подтверждено ≠ не заблокировано", () => {
  test("панель не загружена: кнопку не блокируем, но и не обещаем", () => {
    expect(isCapabilityBlocked(null, "domain"), "мёртвая кнопка на незнании").toBe(false);
    expect(isCapabilityConfirmed(null, "domain"), "обещание на незнании").toBe(false);
  });

  test("возможности нет в списке — то же самое", () => {
    const idx = indexCapabilities([{ id: "pages", name: "Pages", status: "live" }] as never);
    expect(isCapabilityBlocked(idx, "domain")).toBe(false);
    expect(isCapabilityConfirmed(idx, "domain")).toBe(false);
  });

  test("статус live: и не заблокировано, и подтверждено", () => {
    const idx = indexCapabilities([{ id: "domain", name: "Домен", status: "live" }] as never);
    expect(isCapabilityBlocked(idx, "domain")).toBe(false);
    expect(isCapabilityConfirmed(idx, "domain")).toBe(true);
  });

  test("not_available: заблокировано и НЕ подтверждено", () => {
    // Ровно состояние домена после замера 28.08: зона не делегирована.
    const idx = indexCapabilities([{ id: "domain", name: "Домен", status: "not_available" }] as never);
    expect(isCapabilityBlocked(idx, "domain")).toBe(true);
    expect(isCapabilityConfirmed(idx, "domain")).toBe(false);
  });

  test("needs_token ведёт себя как not_available", () => {
    const idx = indexCapabilities([{ id: "vercel", name: "Vercel", status: "needs_token" }] as never);
    expect(isCapabilityBlocked(idx, "vercel")).toBe(true);
    expect(isCapabilityConfirmed(idx, "vercel")).toBe(false);
  });
});
