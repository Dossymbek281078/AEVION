import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildWaitlistConfirmEmail,
  buildPlatformWaitlistEmail,
  buildEmailVerifyEmail,
} from "../src/lib/constitutionBrevo";

/**
 * Обещание под полем листа ожидания: «Отписка одной ссылкой в каждом письме».
 *
 * 🔴 Повод (11.10.2026, нашёл оркестратор): ссылка стояла только в HTML-части и
 * в заголовке `List-Unsubscribe`, а в `text/plain` её не было ни в одном
 * варианте письма. Кто читает письмо текстом — обещания не получал. Это не
 * косметика: обещание на странице, которого продукт не выполняет.
 *
 * Сторож идёт по СОВОКУПНОСТИ вариантов подтверждения (их три: конституция,
 * платформа ru, платформа en) и печатает знаменатель. Он НЕ требует отписку от
 * писем-транзакций (подтверждение адреса) — отписаться от подтверждения адреса
 * бессмысленно, и это проверено отдельным отрицательным контролем ниже, чтобы
 * сторож не разъехался с замыслом.
 */

const АДРЕС = "probe-user-89@test.aev";
const СЕКРЕТ = "test-waitlist-unsub-secret-0123456789";
const ИСХОДНЫЕ = {
  secret: process.env.WAITLIST_UNSUB_SECRET,
  jwt: process.env.AUTH_JWT_SECRET,
  contact: process.env.WAITLIST_UNSUB_CONTACT,
};

/** Все варианты письма ПОДТВЕРЖДЕНИЯ листа ожидания — по одному на источник. */
const ВАРИАНТЫ: Array<{ имя: string; построить: () => { textContent?: string }; слово: string }> = [
  {
    имя: "конституция (source constitution)",
    построить: () => buildWaitlistConfirmEmail(АДРЕС, "constitution"),
    слово: "Отписаться",
  },
  {
    имя: "платформа ru (source cyberchess)",
    построить: () => buildWaitlistConfirmEmail(АДРЕС, "cyberchess"),
    слово: "Отписаться",
  },
  {
    имя: "платформа ru напрямую (без source)",
    построить: () => buildPlatformWaitlistEmail(АДРЕС, "qskyway"),
    слово: "Отписаться",
  },
  {
    // Английский выбирается `isEnglishSource`: метка РАВНА "en" либо начинается
    // с "en-". Моя первая версия теста передавала "cyberchess-en" и получала
    // РУССКОЕ письмо — а проверка «или англ, или рус» это скрывала. Теперь
    // вариант стоит в совокупности и проверяется той же строгостью.
    имя: "платформа en (метка en)",
    построить: () => buildWaitlistConfirmEmail(АДРЕС, "cyberchess,en"),
    слово: "Unsubscribe",
  },
];
/** Сколько вариантов было на 11.10.2026. Упало ниже — сторож краснеет, а не молчит. */
const ВАРИАНТОВ_БЫЛО = 4;

beforeEach(() => {
  process.env.WAITLIST_UNSUB_SECRET = СЕКРЕТ;
  delete process.env.WAITLIST_UNSUB_CONTACT;
});
afterEach(() => {
  for (const [k, v] of [
    ["WAITLIST_UNSUB_SECRET", ИСХОДНЫЕ.secret],
    ["AUTH_JWT_SECRET", ИСХОДНЫЕ.jwt],
    ["WAITLIST_UNSUB_CONTACT", ИСХОДНЫЕ.contact],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("Лист ожидания: отписка есть и в ТЕКСТОВОЙ части письма", () => {
  it("прибор видит предмет: знаменатель не упал и текстовая часть непуста", () => {
    expect(ВАРИАНТЫ.length).toBeGreaterThanOrEqual(ВАРИАНТОВ_БЫЛО);
    for (const в of ВАРИАНТЫ) {
      const t = в.построить().textContent ?? "";
      expect(t.length, `${в.имя}: текстовой части нет вовсе`).toBeGreaterThan(40);
    }
  });

  it("🔴 у каждого варианта в text/plain стоит РАБОЧАЯ ссылка отписки", () => {
    let проверено = 0;
    for (const в of ВАРИАНТЫ) {
      const t = в.построить().textContent ?? "";
      expect(t, `${в.имя}: нет подписи отписки`).toContain(в.слово);
      expect(t, `${в.имя}: нет ссылки на ручку отписки`).toContain("/unsubscribe?email=");
      expect(t, `${в.имя}: ссылка без токена — отписка не сработает`).toMatch(/[?&]t=[^\s]+/);
      проверено += 1;
    }
    expect(проверено).toBe(ВАРИАНТЫ.length);
  });

  it("в text/plain не должно быть РАЗМЕТКИ — человек увидит её как есть", () => {
    for (const в of ВАРИАНТЫ) {
      const t = в.построить().textContent ?? "";
      expect(t, `${в.имя}: в текстовой части HTML-тег`).not.toMatch(/<a\s|<\/a>|style=/);
    }
  });

  it("английское письмо отписывается ПО-АНГЛИЙСКИ и НЕ по-русски", () => {
    const t = buildWaitlistConfirmEmail(АДРЕС, "cyberchess,en").textContent ?? "";
    expect(t).toContain("Unsubscribe");
    expect(t, "в английском письме русская подпись отписки").not.toContain("Отписаться");
    // Контроль того же прибора в обратную сторону: русский вариант — наоборот.
    const r = buildWaitlistConfirmEmail(АДРЕС, "cyberchess").textContent ?? "";
    expect(r).toContain("Отписаться");
    expect(r).not.toContain("Unsubscribe");
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: нет секрета — вместо мёртвой ссылки живой адрес", () => {
    delete process.env.WAITLIST_UNSUB_SECRET;
    delete process.env.AUTH_JWT_SECRET;
    process.env.WAITLIST_UNSUB_CONTACT = "unsub-probe@aevion.app";
    for (const в of ВАРИАНТЫ) {
      const t = в.построить().textContent ?? "";
      expect(t, `${в.имя}: без секрета осталась ссылка, которая молча не сработает`).not.toContain(
        "/unsubscribe?email=",
      );
      expect(t, `${в.имя}: без секрета не названо, куда писать`).toContain("unsub-probe@aevion.app");
    }
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: от письма-транзакции отписка НЕ требуется", () => {
    // Граница замысла: подтверждение адреса — не рассылка. Если однажды решим
    // иначе, покраснеет этот тест, и решение будет принято осознанно.
    const t = buildEmailVerifyEmail(АДРЕС, "https://api.aevion.app/verify?t=x").textContent ?? "";
    expect(t.length).toBeGreaterThan(20);
    expect(t).not.toContain("Отписаться");
  });
});
