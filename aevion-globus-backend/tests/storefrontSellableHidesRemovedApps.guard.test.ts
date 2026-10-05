import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: витрина и касса отвечают на ОДИН вопрос «продаётся ли отдельно».
 *
 * ЗАЧЕМ (баг, найденный 05.10.2026). 01.10 основатель снял с отдельной продажи
 * qright, qsign, qskyway, startup_exchange — касса им отвечает 400 `invalid_app`
 * («входит в подписку»). Но ручка состояния `/healthz.sellable` продолжала
 * числить их `app_<slug>_lite` среди `configured`: своего варианта у них нет,
 * однако `fallbackVariantForReference` держит их на варианте tier_lite. Витрина
 * зажигает кнопку «Buy» ИМЕННО по `configured` — получалась ЖИВАЯ кнопка «Buy»
 * в МЁРТВУЮ кассу, ровно тот worst-case, о котором предупреждает
 * lemonSqueezyVariants.ts: «предикат ОДИН на кассу и витрину».
 *
 * Сторож делает НАСТОЯЩИЙ запрос к ручке (а не повторяет её логику копией) и
 * проверяет ТЕЛО ответа. Негативный контроль встроен: уберите фильтр в
 * checkout.ts — и `app_qright_lite` снова придёт через fallback, тест покраснеет.
 */

const СНЯТЫЕ = [
  "app_qright_lite",
  "app_qsign_lite",
  "app_qskyway_lite",
  "app_startup_exchange_lite",
] as const;

// Переменные варианта: tier_lite включает запасной путь (из-за него снятые и
// попадали в configured), multichat_lite — свой вариант контрольного модуля.
const ENV_LITE = "LEMON_SQUEEZY_VARIANT_LITE";
const ENV_MULTICHAT = "LEMON_SQUEEZY_VARIANT_MULTICHAT_LITE";
const ВСЕ_ENV = [ENV_LITE, ENV_MULTICHAT];

const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

const сохранено: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const п of ВСЕ_ENV) сохранено[п] = process.env[п];
  // Запасной путь ЖИВ: без этого снятые не попали бы в configured и до
  // фильтра, и тест ничего бы не стерёг (ложный зелёный).
  process.env[ENV_LITE] = "11111";
  process.env[ENV_MULTICHAT] = "22222";
});
afterAll(() => {
  for (const [п, з] of Object.entries(сохранено)) {
    if (з === undefined) delete process.env[п];
    else process.env[п] = з;
  }
});

async function sellable() {
  const res = await request(приложение()).get("/api/pricing/checkout/healthz");
  expect(res.status).toBe(200);
  const s = res.body?.providers?.lemonsqueezy?.sellable;
  expect(s, "в ответе нет providers.lemonsqueezy.sellable").toBeTruthy();
  return { configured: s.configured as string[], missing: s.missing as string[] };
}

describe("витрина не зажигает «Buy» у снятых с отдельной продажи приложений", () => {
  test("КОНТРОЛЬ: запасной путь действительно живёт (tier_lite продаётся)", async () => {
    // Если бы tier_lite не был sellable, снятые не прошли бы через fallback и
    // проверка ниже оказалась бы пустой — она должна стеречь реальный случай.
    const { configured } = await sellable();
    expect(configured, "tier_lite не sellable — fallback не активен, сторож ничего не проверяет")
      .toContain("tier_lite");
  });

  test("снятые НЕ числятся продаваемыми — ни в configured, ни в missing", async () => {
    const { configured, missing } = await sellable();
    const зажжены = СНЯТЫЕ.filter((r) => configured.includes(r));
    expect(зажжены, "у снятого приложения живая кнопка «Buy» (configured)").toEqual([]);
    // И не в missing: missing даёт серую кнопку «оформить онлайн пока нельзя»,
    // а у снятых положение постоянное — витрина обязана показать «входит в
    // подписку» (ни в одном из списков → безТовараСсылка).
    const серые = СНЯТЫЕ.filter((r) => missing.includes(r));
    expect(серые, "снятое попало в missing — витрина покажет серую кнопку, а не «входит в подписку»")
      .toEqual([]);
  });

  test("КОНТРОЛЬ: Multichat и тарифы по-прежнему продаются", async () => {
    const { configured } = await sellable();
    expect(configured, "Multichat пропал из продажи — правка задела контроль")
      .toContain("app_multichat_lite");
    for (const t of ["tier_lite", "tier_medium", "tier_pro", "tier_full", "tier_max"]) {
      // Тарифы продаются только если заданы их варианты; здесь задан лишь lite,
      // поэтому строго проверяем, что фильтр не ВЫБРОСИЛ ни одного заведённого
      // тарифа: tier_lite обязан остаться (задан выше).
    }
    expect(configured).toContain("tier_lite");
  });

  test("касса для снятого — честный 400 invalid_app (не задета)", async () => {
    const res = await request(приложение())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", app: "qskyway", currency: "USD" });
    expect(res.status, "снятое приложение обязано отвечать 400, а не 503/200").toBe(400);
    expect(res.body?.error).toBe("invalid_app");
  });
});
