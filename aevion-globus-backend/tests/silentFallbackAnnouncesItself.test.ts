/**
 * Запас, подменяющий товар, обязан о себе объявлять.
 *
 * Обе кассы при неизвестной ссылке молча берут товар по умолчанию. Соседнее
 * окно замерило цену этого молчания на витрине 02.09: наборы показывают
 * $29/$33/$39, а касса берёт $59 — покупатель платит за другой товар.
 *
 * ОТКАЗЫВАТЬ НЕЛЬЗЯ, и это проверено, а не предположено: `bureau.ts` передаёт
 * в кассу идентификатор проверки (`reference: verificationId`), который не
 * сопоставлен НАМЕРЕННО и живёт ровно на товаре по умолчанию. Запрет сломал бы
 * работающую оплату — лечение вышло бы хуже болезни.
 *
 * Поэтому поведение прежнее, а молчание кончилось: в журнале остаётся, какая
 * ссылка не нашлась и какую сумму мы при этом назвали человеку. Расхождение
 * этих двух чисел и есть дефект, и теперь его видно без покупки.
 *
 * Сторож нужен потому, что «будем писать в журнал» — обещание, а не механизм:
 * строку легко потерять при следующей правке, и никто этого не заметит.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { gumroadPaymentProvider } from "../src/lib/payment/gumroadProvider";
import { lemonSqueezyPaymentProvider } from "../src/lib/payment/lemonSqueezyProvider";

const СОХРАНЁННЫЕ = { ...process.env };
afterEach(() => {
  process.env = { ...СОХРАНЁННЫЕ };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("подмена товара по умолчанию", () => {
  it("Gumroad говорит, что пермалинк не настроен ни одним именем", async () => {
    delete process.env.GUMROAD_PERMALINK_NEIZVESTNYJ_NABOR;
    delete process.env.GUMROAD_DEFAULT_PERMALINK;
    const предупреждения: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      предупреждения.push(a.map(String).join(" "));
    });

    await gumroadPaymentProvider.createIntent({
      reference: "neizvestnyj-nabor",
      amountCents: 2900,
      currency: "USD",
      description: "набор",
      email: "a@b.co",
    });

    const строка = предупреждения.join(" | ");
    expect(строка, "подмена прошла молча").not.toBe("");
    expect(строка, "в журнале не названа ссылка").toContain("neizvestnyj-nabor");
  });

  it("LemonSqueezy называет и ссылку, и сумму, которую мы обещали", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "111";
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "222";

    const предупреждения: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      предупреждения.push(a.map(String).join(" "));
    });
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: "chk_1", attributes: { url: "https://ls.test/checkout" } } }),
      text: async () => "",
    }));

    await lemonSqueezyPaymentProvider.createIntent({
      reference: "ip-suite",
      amountCents: 2900,
      currency: "USD",
      description: "IP Suite",
      email: "a@b.co",
    });

    const строка = предупреждения.join(" | ");
    expect(строка, "подмена прошла молча").not.toBe("");
    expect(строка, "в журнале не названа ссылка").toContain("ip-suite");
    // Сумма важнее ссылки: именно её расхождение с ценой товара и есть убыток.
    expect(строка, "не названа сумма, которую мы обещали человеку").toContain("2900");
  });

  it("при известной ссылке в журнал ничего не пишется", async () => {
    /*
     * Обратная сторона: предупреждение на КАЖДОЙ покупке — это шум, который
     * перестают читать. Проверяем, что нормальный путь молчит.
     */
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "111";
    process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "333";

    const предупреждения: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      предупреждения.push(a.map(String).join(" "));
    });
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: "chk_2", attributes: { url: "https://ls.test/checkout" } } }),
      text: async () => "",
    }));

    await lemonSqueezyPaymentProvider.createIntent({
      reference: "tier_lite_monthly",
      amountCents: 1900,
      currency: "USD",
      description: "Lite",
      email: "a@b.co",
    });

    expect(предупреждения.join(" | "), "шум на нормальной покупке").toBe("");
  });
});
