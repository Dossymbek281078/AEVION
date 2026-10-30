/*
 * Отказ по бесплатной норме (402 free_quota_exceeded) поднимает окно тарифа.
 * Замер прода 13.10.2026 (окно Приложения-31.12): нормы бюро, HealthAI и
 * QVenture включены, а перехватчик ловил только upgrade_required — гость
 * видел «Не удалось» или голый код ошибки без ссылки на оплату.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installPaywallInterceptor, PAYWALL_EVENT, стенаИзНормы, type PaywallPayload } from "../paywall";

// Ровно та форма, что отдаёт бэкенд: aevion-globus-backend/src/lib/freeActionQuota.ts, отказПоНорме.
const НОРМА_402 = {
  error: "free_quota_exceeded",
  module: "healthai",
  used: 2,
  freePerMonth: 1,
  upgradeUrl: "https://aevion.app/pricing",
  message: "Бесплатная норма на этот месяц исчерпана (1). Подписка снимает ограничение — оформить: https://aevion.app/pricing",
};

describe("стенаИзНормы", () => {
  it("отказ по норме превращается в стену с адресом оплаты и честным текстом о пределе (с 30.10 — не текст сервера: в нём сырой адрес)", () => {
    const с = стенаИзНормы(НОРМА_402);
    expect(с).not.toBeNull();
    expect(с!.module).toBe("healthai");
    expect(с!.upgradeUrl).toBe("https://aevion.app/pricing");
    expect(с!.message).toMatch(/исчерпан/i);
    expect(с!.requiredTiers).not.toContain("free");
  });

  it("КОНТРОЛЬ: прочие 402 и битые тела стеной не считаются", () => {
    expect(стенаИзНормы({ ...НОРМА_402, error: "payment_failed" })).toBeNull();
    expect(стенаИзНормы({ ...НОРМА_402, upgradeUrl: undefined })).toBeNull();
    expect(стенаИзНормы(null)).toBeNull();
    expect(стенаИзНормы("free_quota_exceeded")).toBeNull();
  });
});

describe("перехватчик: 402 по норме поднимает окно тарифа", () => {
  let origFetch: typeof fetch;
  beforeEach(() => {
    origFetch = window.fetch;
    delete (window as unknown as Record<symbol, unknown>)[Symbol.for("aevion.paywall.fetchPatched")];
  });
  afterEach(() => {
    window.fetch = origFetch;
  });

  const ответ = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("событие окна приходит, а тело остаётся читаемым для страницы", async () => {
    window.fetch = vi.fn().mockResolvedValue(ответ(402, НОРМА_402));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    const res = await window.fetch("/api-backend/api/healthai/check");
    expect((await res.json()).error).toBe("free_quota_exceeded");
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent<PaywallPayload>;
    expect(evt.detail.module).toBe("healthai");
    expect(evt.detail.upgradeUrl).toBe("https://aevion.app/pricing");
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });

  it("КОНТРОЛЬ: 402 с чужим кодом окна не поднимает", async () => {
    window.fetch = vi.fn().mockResolvedValue(ответ(402, { error: "card_declined" }));
    installPaywallInterceptor();
    const handler = vi.fn();
    window.addEventListener(PAYWALL_EVENT, handler as EventListener);
    await window.fetch("/api-backend/api/qmaskcard/x");
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(PAYWALL_EVENT, handler as EventListener);
  });
});

/*
 * 30.10.2026 (окно Приложения-2·Бюро), кадр прода 043aa4cc7, гость ru 1280 на /qright,
 * 4-я регистрация → 402 free_quota_exceeded: окно показало «На этом аккаунте покупки
 * нет. Если вы оплачивали другим адресом — войдите под ним», а про исчерпанные
 * 3 бесплатных — ни слова. Причина: текст сервера содержит адрес «https://…/pricing»,
 * PaywallModal такие тексты заменяет общей фразой про покупки (сАдресами). Стена из
 * нормы обязана нести свой честный текст: сколько бесплатных, что исчерпаны, что
 * делать (войти, если подписка есть, или оформить план) — и без сырых адресов.
 */
describe("стена из нормы говорит правду о пределе", () => {
  const норма = { ...НОРМА_402, module: "qright", used: 4, freePerMonth: 3 };
  afterEach(() => { document.documentElement.lang = ""; });

  it("ru: называет норму и исчерпание, без сырого адреса", () => {
    document.documentElement.lang = "ru";
    const с = стенаИзНормы(норма)!;
    expect(с.message).not.toMatch(/https?:\/\//);
    expect(с.message).toMatch(/3/);
    expect(с.message).toMatch(/исчерпан/i);
    expect(с.message).toMatch(/войдите/i);
    expect(с.message).toMatch(/план|подписк/i);
    expect(с.upgradeUrl).toBe("https://aevion.app/pricing");
  });

  it("en: страница на английском — текст стены английский", () => {
    document.documentElement.lang = "en";
    const с = стенаИзНормы(норма)!;
    expect(с.message).not.toMatch(/https?:\/\//);
    expect(с.message).toMatch(/3/);
    expect(с.message).toMatch(/used up|exhausted/i);
    expect(с.message).toMatch(/sign in/i);
    expect(с.message).not.toMatch(/[а-яА-Я]/);
  });

  it("kk: страница на казахском — текст стены казахский (проход kk на проде 30.10.2026)", () => {
    document.documentElement.lang = "kk";
    const с = стенаИзНормы(норма)!;
    expect(с.message).not.toMatch(/https?:\/\//);
    expect(с.message).toMatch(/3/);
    expect(с.message).toMatch(/таусылды/);
    expect(с.message).toMatch(/кіріңіз/);
    expect(с.message).not.toMatch(/исчерпан|used up/i);
  });

  it("КОНТРОЛЬ: норма без чисел — текст всё равно честный и без адреса", () => {
    const с = стенаИзНормы({ ...НОРМА_402, used: undefined, freePerMonth: undefined })!;
    expect(с.message).not.toMatch(/https?:\/\//);
    expect(с.message).toMatch(/исчерпан/i);
  });
});
