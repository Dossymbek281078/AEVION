/**
 * Приём заявок агентства: проверка входа ДО записи.
 *
 * Повод (20.09.2026): форма на сайте агентства открывала почтовую программу
 * посетителя вместо отправки нам, и на телефоне заявка терялась. Ручка
 * POST /api/agency/lead принимает её напрямую — значит она же и первый рубеж,
 * где заявка может молча испортиться.
 *
 * Здесь проверяется именно РЕШЕНИЕ «принять или отказать», а не запись в базу:
 * контакт, по которому нельзя ответить, делает заявку бесполезной обеим сторонам.
 */
import { describe, it, expect } from "vitest";
import { проверитьЗаявку } from "../src/routes/agencyLead";

const годная = { contact: "elena@grandec.kz", message: "Пришлю три заявки, интересно" };

describe("приём заявки агентства", () => {
  it("принимает заявку с почтой", () => {
    const r = проверитьЗаявку(годная);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.данные.contact).toBe("elena@grandec.kz");
  });

  it("принимает телефон в любом виде — люди пишут и так, и так", () => {
    for (const тел of ["+7 (777) 123-45-67", "87771234567", "+77012223344"]) {
      expect(проверитьЗаявку({ ...годная, contact: тел }).ok).toBe(true);
    }
  });

  it("КОНТРОЛЬ: без контакта не принимает — ответить будет некуда", () => {
    const r = проверитьЗаявку({ message: "хочу автоматизацию" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.причина).toBe("contact_required");
  });

  it("КОНТРОЛЬ: мусор вместо контакта не принимает", () => {
    const r = проверитьЗаявку({ contact: "позвоните мне", message: "хочу" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.причина).toBe("contact_invalid");
  });

  it("КОНТРОЛЬ: короткое число не считается телефоном", () => {
    // 9 цифр — не номер; иначе «2026 год» прошло бы как контакт.
    expect(проверитьЗаявку({ contact: "123456789", message: "х" }).ok).toBe(false);
  });

  it("КОНТРОЛЬ: пустое сообщение не принимает", () => {
    const r = проверитьЗаявку({ contact: "a@b.kz", message: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.причина).toBe("message_required");
  });

  it("обрезает слишком длинное, а не падает", () => {
    const r = проверитьЗаявку({ ...годная, name: "и".repeat(500), source: "s".repeat(500) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.данные.name || "").length).toBeLessThanOrEqual(120);
      expect((r.данные.source || "").length).toBeLessThanOrEqual(200);
    }
  });

  it("КОНТРОЛЬ: письмо-роман отклоняется целиком, а не режется молча", () => {
    const r = проверитьЗаявку({ ...годная, message: "я".repeat(5001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.причина).toBe("message_too_long");
  });

  it("КОНТРОЛЬ: не объект и пустой вход не роняют разбор", () => {
    expect(проверитьЗаявку(undefined).ok).toBe(false);
    expect(проверитьЗаявку("строка").ok).toBe(false);
    expect(проверитьЗаявку(null).ok).toBe(false);
  });
});
