import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { verifyGumroadSaleDetailed } from "../src/lib/payment/gumroadProvider";

/*
 * 🔴 ПУСТОЙ ИДЕНТИФИКАТОР ПРОДАЖИ — ПРИЗНАК ПОДДЕЛКИ, А НЕ НАША ПОМЕХА.
 *
 * Повод: Sentry AEVION-BACKEND-1E, 22:07 08.10.2026 —
 * «gumroad_sale_unverifiable_provisioned» вместе с «неизвестный товар
 * Gumroad: permalink=aevion». Цепочка, прочитанная в коде:
 *   gumroadWebhook.ts:477  saleId = raw.sale_id ?? raw.id ?? eventId ?? ""
 *     -> пинг без этих полей даёт ПУСТУЮ строку
 *   gumroadProvider.ts     if (!saleId) -> "unverifiable"
 *   gumroadWebhook.ts:581  ветка "unverifiable" ВЫДАЁТ доступ (намеренно,
 *                          чтобы не наказывать покупателя за наш отказ)
 * Подписи у Gumroad на проде НЕТ (замер 02.09.2026: пустое тело получает 200,
 * остальные три кассы отвечают 401) — значит сверка продажи единственный
 * замок, и он открывался ОТСУТСТВИЕМ поля в запросе.
 *
 * Почему отдельный файл: все соседние тесты Gumroad подменяют модуль
 * провайдера (`vi.mock(".../gumroadProvider")`) и потому проверяют реакцию
 * вебхука на вердикт, а не сам вердикт. Настоящую функцию не звал никто.
 *
 * Поддельный пинг на прод НЕ отправлялся: доказывать дыру её эксплуатацией
 * нельзя — это создало бы незаработанный доступ. Здесь она воспроизведена
 * локально.
 */
describe("вердикт сверки: пустой id — отказ, а не «непроверяемо»", () => {
  const былТокен = process.env.GUMROAD_ACCESS_TOKEN;
  beforeEach(() => { process.env.GUMROAD_ACCESS_TOKEN = "test-token"; });
  afterEach(() => {
    if (былТокен === undefined) delete process.env.GUMROAD_ACCESS_TOKEN;
    else process.env.GUMROAD_ACCESS_TOKEN = былТокен;
  });

  test("пустой id -> not_found (сети не касаемся: проверять нечего)", async () => {
    const r = await verifyGumroadSaleDetailed("");
    process.stderr.write(`[сторож] пустой id -> ${r.verdict}${String.fromCharCode(10)}`);
    expect(
      r.verdict,
      "пустой id снова даёт «непроверяемо» — а на нём вебхук ВЫДАЁТ доступ",
    ).toBe("not_found");
    expect(r.sale).toBeNull();
  });

  test("КОНТРОЛЬ: нет токена, но id есть -> unverifiable (вина наша, покупателя не наказываем)", async () => {
    delete process.env.GUMROAD_ACCESS_TOKEN;
    const r = await verifyGumroadSaleDetailed("real-sale-123");
    process.stderr.write(`[сторож] без токена, id есть -> ${r.verdict}${String.fromCharCode(10)}`);
    expect(
      r.verdict,
      "настоящий покупатель перестал проходить при нашем недоступном API — правка зашла слишком далеко",
    ).toBe("unverifiable");
  });
});
