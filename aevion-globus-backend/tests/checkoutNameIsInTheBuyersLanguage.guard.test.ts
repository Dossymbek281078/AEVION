import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Имя товара на странице оплаты — на языке ПОКУПАТЕЛЯ, а не всегда по-русски.
 *
 * ЗАМЕР 05.10.2026 на живой кассе DevHub, все пять сроков. Страница оплаты с
 * `lang="en-US"`:
 *   заголовок вкладки : «AEVION DevHub Lite — 1 месяц - Checkout»
 *   строка товара     : «AEVION DevHub Lite — 1 месяц (AEVION DevHub — Lite (1 mo))»
 *   сумма             : $200.00 billed every month   ← ВЕРНА, дело не в деньгах
 * Английское имя у варианта уже было — и шло вторым, в скобках.
 *
 * Путь строки: checkout.ts собирает `description` → lemonSqueezyProvider кладёт
 * его в `product_options.name` → покупатель читает это в заголовке, в строке
 * товара и на кнопке оплаты. Подпись срока бралась из monthsLabelRu, жёстко
 * русского, для любого покупателя — хотя язык покупателя к этому месту уже
 * известен и передаётся кассе отдельным полем `locale`.
 *
 * Почему это деньги: за 14 дней 13 начатых оплат и НИ ОДНОЙ завершённой.
 * Кириллица в момент ввода карты — потеря доверия там, где она дороже всего.
 *
 * Сторож ПОВЕДЕНЧЕСКИЙ: он смотрит, что уходит в кассу, а не какие слова
 * написаны в коде. Переименуют помощника — сторож продолжит работать.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

/** Перехватываем вход кассы: нас интересует ровно product_options.name. */
const вызовы: Array<{ description: string; locale?: string | null }> = [];
vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    id: "lemonsqueezy",
    isConfigured: () => true,
    createIntent: async (input: any) => {
      вызовы.push({ description: String(input.description ?? ""), locale: input.locale ?? null });
      return { url: "https://aevion.lemonsqueezy.com/checkout/custom/probe", provider: "lemonsqueezy", amountCents: input.amountCents };
    },
  },
}));

const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

async function купить(язык: string | null, тело: Record<string, unknown>) {
  вызовы.length = 0;
  const r = request(приложение()).post("/api/pricing/checkout/session");
  if (язык !== null) r.set("Accept-Language", язык);
  const ответ = await r.send({ email: "buyer@example.test", ...тело });
  return { ответ, имя: вызовы[0]?.description ?? "" };
}

const КИРИЛЛИЦА = /[а-яА-Я]/;

beforeEach(() => {
  process.env.LEMON_SQUEEZY_API_KEY = "ls-probe";
  process.env.LEMON_SQUEEZY_STORE_ID = "1";
  // Без секрета вебхука касса считается неспособной ВЫДАТЬ купленное
  // (lemonSqueezyCanDeliver), и сессия честно отвечает 503 — поймал на себе.
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "probe-secret";
  process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "1";
  // Варианты товаров: без них ссылка не продаётся и сессия честно отвечает 503
  // (lemonSqueezySellable). Имена — LEMON_SQUEEZY_VARIANT_<ПРИЛОЖЕНИЕ>_<СТУПЕНЬ>
  // и LEMON_SQUEEZY_VARIANT_<СТУПЕНЬ> для планеты.
  for (const ступень of ["LITE", "MEDIUM", "PRO", "FULL", "MAX"]) {
    process.env["LEMON_SQUEEZY_VARIANT_DEVHUB_" + ступень] = "1";
    process.env["LEMON_SQUEEZY_VARIANT_" + ступень] = "1";
  }
  delete process.env.PAYBOX_MERCHANT_ID;
  delete process.env.PAYPAL_CLIENT_ID;
});

describe("имя товара в кассе — на языке покупателя", () => {
  test("прибор исправен: имя вообще доходит до кассы", async () => {
    const { ответ, имя } = await купить("en-US", { tierId: "lite", app: "devhub" });
    expect(ответ.status, "сессия не создалась — мерить нечего").toBe(200);
    expect(имя.length, "в кассу не ушло имя товара").toBeGreaterThan(5);
    expect(имя, "имя не называет приложение").toContain("DevHub");
  });

  test("англоязычный покупатель НЕ видит кириллицы — ни в одном из пяти сроков", async () => {
    for (const tierId of ["lite", "medium", "pro", "full", "max"]) {
      const { имя } = await купить("en-US", { tierId, app: "devhub" });
      expect(КИРИЛЛИЦА.test(имя), `срок ${tierId}: кириллица в имени товара → «${имя}»`).toBe(false);
      expect(имя, `срок ${tierId}: срок не назван по-английски`).toMatch(/\d+ months?$/);
    }
  });

  test("русскоязычный покупатель видит русское — экономия не ломает своих", async () => {
    // КОНТРОЛЬ в обратную сторону. Без него починка могла бы просто выкинуть
    // русский язык совсем, и это был бы не ремонт, а другая поломка.
    const { имя } = await купить("ru-RU,ru;q=0.9", { tierId: "lite", app: "devhub" });
    expect(КИРИЛЛИЦА.test(имя), `русскому покупателю ушло «${имя}»`).toBe(true);
    expect(имя).toContain("1 месяц");
  });

  test("язык неизвестен — английский, а не русский наугад", async () => {
    const { имя } = await купить(null, { tierId: "lite", app: "devhub" });
    expect(КИРИЛЛИЦА.test(имя), `без Accept-Language ушло «${имя}»`).toBe(false);
  });

  test("язык передаётся кассе отдельным полем — это НЕ замена имени", async () => {
    // Чтобы починка имени не выглядела достаточной: locale отвечает за надписи
    // самой кассы, имя товара — за то, что покупатель читает первым.
    await купить("en-US", { tierId: "lite", app: "devhub" });
    expect(вызовы[0]?.locale, "язык покупателя до кассы не доходит").toBeTruthy();
  });

  test("планета без приложения — то же правило", async () => {
    const { имя } = await купить("en-US", { tierId: "max" });
    expect(КИРИЛЛИЦА.test(имя), `тариф планеты: «${имя}»`).toBe(false);
  });
});
