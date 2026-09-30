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

  /*
   * 🔴 ОЖИДАНИЕ ЗАМЕНЕНО 30.09.2026: теперь это ОТКАЗ, а не запись в журнал.
   *
   * Прежняя редакция закрепляла договор «не меняем поведение, а прекращаем
   * молчать»: провайдер писал предупреждение и продавал товар по умолчанию.
   * Осторожность была разумной, пока не измерили цену этой осторожности.
   *
   * Замер 30.09: товар по умолчанию на проде — подписка DevHub Studio Pro
   * $149/мес, а бюро авторства посылало сюда `reference: <номер проверки>`,
   * которому в кассе не сопоставлено ничего. То есть витрина обещала $29 в
   * месяц, списали бы $149 и выдали бы ЧУЖОЙ продукт, а подтверждение бюро не
   * пришло бы вовсе. Журнал читают потом, деньги уходят сразу.
   *
   * Кто сюда доходит — измерено: вызовов createIntent у провайдера два. Касса
   * пускает запрос только со сопоставленной ссылкой (свой вариант или запасной),
   * второй вызов — бюро, и это ровно дефект. Значит отказ не ломает ни одной
   * работающей продажи. Смысл теста сохранён: сбой обязан называть себя — только
   * теперь он называет себя отказом, а не строкой, которую никто не прочитал.
   */
  it("несопоставленная ссылка останавливает продажу и называет причину", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "111";
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "222";

    let ушлоЗапросов = 0;
    vi.stubGlobal("fetch", async () => {
      ушлоЗапросов += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "chk_1", attributes: { url: "https://ls.test/checkout" } } }),
        text: async () => "",
      };
    });

    const попытка = lemonSqueezyPaymentProvider.createIntent({
      reference: "ip-suite",
      amountCents: 2900,
      currency: "USD",
      description: "IP Suite",
      email: "a@b.co",
    });

    // Причина названа полностью: и ссылка, и сумма, которую мы обещали человеку.
    await expect(попытка).rejects.toThrow(/ip-suite/);
    expect(ушлоЗапросов, "касса не должна была ничего создать").toBe(0);

    try {
      await lemonSqueezyPaymentProvider.createIntent({
        reference: "ip-suite",
        amountCents: 2900,
        currency: "USD",
        description: "IP Suite",
        email: "a@b.co",
      });
      throw new Error("отказа не было — это и есть дефект");
    } catch (e) {
      const текст = e instanceof Error ? e.message : String(e);
      expect(текст, "не названа сумма, которую мы обещали человеку").toContain("2900");
      expect(текст, "не названа ссылка").toContain("ip-suite");
    }
  });

  it("при известной ссылке в журнал ничего не пишется", async () => {
    /*
     * Обратная сторона: предупреждение на КАЖДОЙ покупке — это шум, который
     * перестают читать. Проверяем, что нормальный путь молчит.
     */
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "111";
    process.env.LEMON_SQUEEZY_VARIANT_LITE = "333";

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
      reference: "tier_lite",
      amountCents: 40000,
      currency: "USD",
      description: "Lite",
      email: "a@b.co",
    });

    expect(предупреждения.join(" | "), "шум на нормальной покупке").toBe("");
  });
});
