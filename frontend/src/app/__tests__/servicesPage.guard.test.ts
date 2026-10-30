import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SERVICES, serviceTier } from "@/data/services";

/*
 * 28.10.2026 (окно «Продукт»). Страница /services — три услуги по утверждённым основателем
 * ценам (через Оркестратора 28.10): ролики 3/$49, 10/$149, 20 в мес/$249; фото 5/$15,
 * 20/$49; перевод проба 60 с/$19, $29/мин. Цены живут в src/data/services.ts; этот сторож —
 * таблица основателя, с которой сверяется источник: сменить цену в данных без слова
 * основателя нельзя молча. Образцы — файлы в public/services (их отсутствие = пустой
 * квадрат на странице). Кнопка оплаты несёт ?c= (withChannel), форма — keepChannelOrProbe; тема формы svc-<услуга>: /pricing/contact оставляет в topic только [a-z-], цифры тарифа пропали бы.
 * Мутация 28.10: $149 → $139 в данных → тест 1 красный (проверено).
 */
const ТАБЛИЦА_ОСНОВАТЕЛЯ: Record<string, number> = {
  "video-3": 49, "video-10": 149, "video-20m": 249,
  "photo-5": 15, "photo-20": 49,
  "dub-trial": 19, "dub-min": 29,
};
const страница = readFileSync(join(process.cwd(), "src/app/services/ServicesClient.tsx"), "utf8");
const метаданные = readFileSync(join(process.cwd(), "src/app/services/page.tsx"), "utf8");

describe("/services — цены основателя, образцы, метка канала", () => {
  test("🔴 цены тарифов равны таблице основателя 28.10 (7 тарифов)", () => {
    const фактические: Record<string, number> = {};
    for (const s of SERVICES) for (const t of s.tiers) фактические[t.id] = t.priceUsd;
    expect(фактические).toEqual(ТАБЛИЦА_ОСНОВАТЕЛЯ);
    expect(serviceTier("video-20m")?.monthly).toBe(true);
    expect(serviceTier("dub-min")?.perUnit).toBe(true);
  });

  test("ссылка на кассу — только Lemon Squeezy или ещё не выдана (null)", () => {
    for (const s of SERVICES) for (const t of s.tiers) {
      if (t.checkoutUrl !== null) expect(t.checkoutUrl).toMatch(/^https:\/\/[a-z0-9.-]*lemonsqueezy\.com\//);
    }
  });

  test("образцы лежат в public/services", () => {
    for (const s of SERVICES) {
      const f = join(process.cwd(), "public", s.sample.src);
      expect(existsSync(f), s.sample.src).toBe(true);
    }
  });

  test("кнопки несут метку: касса через withChannel, форма через keepChannelOrProbe; плашка ИИ у образцов", () => {
    expect(страница).toContain('withChannel(t.checkoutUrl, channel, "services", raw)');
    expect(страница).toContain("keepChannelOrProbe(`/pricing/contact?topic=svc-${s.id}`, raw, channel)");
    expect(страница).toContain('from "@/components/AiBadge"');
    expect(страница).toContain("<AiBadge");
    expect(страница).toContain("<BuyLink");
  });

  test("английский словарь без кириллицы", () => {
    const en = страница.slice(страница.indexOf("  en: {"), страница.indexOf("} as const;"));
    expect(en.length).toBeGreaterThan(500);
    expect(/[Ѐ-ӿ]/.test(en)).toBe(false);
  });
  test("🔴 единый срок исполнения «до 3 рабочих дней» (слово Оркестратора 29.10: как в товарах LS и письмах Продаж)", () => {
    // 29.10.2026: на странице стояли «1–3 рабочих дня», «3», «1 рабочий день», «2 рабочих дня» — обещания
    // расходились с кассой. Знаменатель: лид + 3 услуги + og:description в метаданных = ru 5; en лид + 3 услуги + og:description = 5.
    // Позже 29.10: метаданные переехали из layout.tsx в page.tsx и стали двуязычными (?lang/кука) —
    // og:description есть и ru, и en, поэтому en = лид + 3 услуги + og = 5.
    const всё = страница + "\n" + метаданные;
    const счёт = (n: string) => всё.split(n).length - 1;
    expect(счёт("до 3 рабочих дней")).toBe(5);
    expect(счёт("within 3 business days")).toBe(5);
    for (const z of ["1 рабочий день", "1–3", "2 рабочих", "1 business day", "1–3 business", "2 business", "за 3 рабочих"]) {
      expect(счёт(z), `запрещённый срок «${z}»`).toBe(0);
    }
  });
});
