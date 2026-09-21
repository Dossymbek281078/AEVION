import { describe, it, expect } from "vitest";
import { withChannel } from "@/lib/products";

/**
 * 🔴 Подписанный адрес кассы не дополняем НИЧЕМ.
 *
 * ЗАМЕР 20.09.2026, с контролями. Настоящий адрес из
 * `POST /api/pricing/checkout/session`:
 *
 *   адрес как есть                              → 200
 *   адрес + checkout[custom][channel]=youtube   → **403**
 *   адрес как есть снова                        → 200
 *
 * Посторонний `foo=bar` тоже даёт 403 — ломается ПОДПИСЬ, а не конкретный
 * параметр. Отвечает сам LemonSqueezy (`x-powered-by: PHP`, в теле «signature»
 * и «invalid»).
 *
 * Кого било: `withChannel` не трогает адрес, когда канала нет. Значит без
 * метки покупка работала, а с меткой человек упирался в 403 — ломался ровно
 * тот, кого мы привели по помеченной ссылке. Наши зонды ходят без канала,
 * поэтому ни одна проверка этого не видела.
 *
 * Метка теперь уходит в ТЕЛЕ запроса на создание сессии.
 */
const ПОДПИСАННЫЙ =
  "https://aevion.lemonsqueezy.com/checkout/custom/77dae7fb-0961-48d1-b2ce-93675e238e16?signature=1056d527c75374c9d73bab1f85625562150ff0a09284e715be30d4baea026091";
const НЕПОДПИСАННЫЙ = "https://aevion.lemonsqueezy.com/buy/8c1f0a2e-0000-0000-0000-000000000000";

describe("метка канала не ломает кассу", () => {
  it("подписанный адрес возвращается БЕЗ изменений", () => {
    expect(withChannel(ПОДПИСАННЫЙ, "youtube", "pricing")).toBe(ПОДПИСАННЫЙ);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: неподписанная ссылка на товар метку принимает", () => {
    // Иначе правка превратилась бы в «никогда не метим LemonSqueezy», и мы
    // потеряли бы привязку там, где она работает.
    const с = withChannel(НЕПОДПИСАННЫЙ, "youtube", "pricing");
    expect(с).toContain("checkout[custom][channel]=youtube");
    expect(с.startsWith(НЕПОДПИСАННЫЙ)).toBe(true);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: Gumroad по-прежнему метится", () => {
    const с = withChannel("https://aevion.gumroad.com/l/orcfbo", "youtube", "pricing");
    expect(с).toContain("channel=youtube");
    expect(с).toContain("utm_source=youtube");
  });

  it("без канала адрес не меняется вовсе", () => {
    expect(withChannel(ПОДПИСАННЫЙ, null, "pricing")).toBe(ПОДПИСАННЫЙ);
    expect(withChannel(НЕПОДПИСАННЫЙ, null, "pricing")).toBe(НЕПОДПИСАННЫЙ);
  });

  it("прибор умеет краснеть: подпись опознаётся и в середине строки", () => {
    const другой = "https://aevion.lemonsqueezy.com/checkout/custom/abc?signature=zzz&x=1";
    expect(withChannel(другой, "youtube", "pricing")).toBe(другой);
  });
});
