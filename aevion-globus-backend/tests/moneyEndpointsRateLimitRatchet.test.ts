import { test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Храповик: список денежных ручек БЕЗ предела темпа зафиксирован.
 *
 * ЗАЧЕМ ИМЕННО ТАК. Искать пределы грепом здесь бесполезно: имён у
 * ограничителей в репозитории около сорока пяти (rateLimit, isRateLimited,
 * programRateLimited, chatRateLimitOk, checkAndIncrRateLimit и так далее).
 * 02.09.2026 свип по двум именам дал неверный знаменатель, и я добавил два
 * ограничителя туда, где защита уже была.
 *
 * Поэтому меряется ПОВЕДЕНИЕ: по каждой ручке идёт поток, и мы смотрим,
 * появится ли отказ. Прибор не знает имён и не может ошибиться в них.
 *
 * ЧТО ЭТО ЛОВИТ: новую денежную ручку, добавленную без предела. Она попадёт
 * в «без предела», список разойдётся с ожидаемым, и сторож покраснеет с
 * именем этой ручки.
 *
 * ЧЕГО НЕ ЛОВИТ (честная граница): величину предела. Ручка с пределом
 * 100000 в минуту пройдёт как «предел есть». Величины проверяются отдельными
 * сторожами по месту.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

// Ожидаемое состояние на 02.09.2026. Каждая строка — осознанное решение.
const БЕЗ_ПРЕДЕЛА_ОЖИДАЕМО = [
  // Чистый расчёт, ничего не пишет и наружу не ходит.
  "/api/pricing/quote",
  // Закрыта токеном партнёрского кабинета: без него 401 на первом же шаге.
  "/api/pricing/partners/deals",
  // Закрыта авторизацией: без неё 401.
  "/api/pricing/subscription/lite-module",
];

const РУЧКИ: Array<[string, unknown]> = [
  ["/api/pricing/quote", { tier: "full", period: "monthly", seats: 1 }],
  ["/api/pricing/promo/validate", { code: "NOPE", tier: "full", period: "monthly" }],
  ["/api/pricing/lead", { email: "l@example.test", message: "hi" }],
  ["/api/pricing/newsletter", { email: "n@example.test" }],
  ["/api/pricing/partners/deals", {}],
  ["/api/pricing/affiliate/apply", { email: "a@example.test" }],
  ["/api/pricing/partners/apply", { email: "p@example.test" }],
  ["/api/pricing/edu/apply", { email: "e@example.test" }],
  ["/api/pricing/affiliate/magic-link", { email: "a@example.test" }],
  ["/api/pricing/partners/magic-link", { email: "p@example.test" }],
  ["/api/pricing/subscription/lite-module", { email: "x@example.test", module: "qsign" }],
  ["/api/pricing/checkout/session", { tier: "nonsense", period: "monthly" }],
];

test(
  "ни одна денежная ручка не потеряла предел темпа",
  async () => {
    const d = mkdtempSync(join(tmpdir(), "aevion-ratchet-"));
    process.env.SUBSCRIPTIONS_FILE = join(d, "subs.jsonl");
    process.env.LEADS_FILE = join(d, "leads.jsonl");
    process.env.NEWSLETTER_FILE = join(d, "news.jsonl");
    try {
      const { pricingRouter } = await import("../src/routes/pricing");
      const { checkoutRouter } = await import("../src/routes/checkout");
      const app = express();
      app.use(express.json());
      app.use("/api/pricing/checkout", checkoutRouter);
      app.use("/api/pricing", pricingRouter);

      const безПредела: string[] = [];
      for (const [путь, тело] of РУЧКИ) {
        let отбили = false;
        for (let i = 0; i < 45; i += 1) {
          const r = await request(app).post(путь).send(тело as object);
          if (r.status === 429) { отбили = true; break; }
        }
        if (!отбили) безПредела.push(путь);
      }

      // КОНТРОЛЬ: хотя бы одна ручка ДОЛЖНА была отбиться. Если отбились все
      // или не отбился никто — сломан прибор, а не продукт.
      expect(
        безПредела.length,
        "ни одна ручка не отбилась — прибор не работает, любой вывод о пределах ничего не значит"
      ).toBeLessThan(РУЧКИ.length);

      expect(
        безПредела.sort(),
        "список ручек БЕЗ предела разошёлся с ожидаемым — новая ручка добавлена без ограничителя либо у существующей предел пропал"
      ).toEqual([...БЕЗ_ПРЕДЕЛА_ОЖИДАЕМО].sort());
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  },
  300000
);
