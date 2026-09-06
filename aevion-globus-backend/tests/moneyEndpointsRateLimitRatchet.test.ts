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

// Метод стоит рядом с путём: храповик перебирал ТОЛЬКО POST, и новая GET-ручка
// статуса выдачи в охват не попала — тот самый «список, написанный рукой,
// отстаёт», только в моём же стороже (замер 04.09.2026).
const РУЧКИ: Array<[string, unknown, "post" | "get"]> = [
  ["/api/pricing/quote", { tier: "full", period: "monthly", seats: 1 }, "post"],
  ["/api/pricing/promo/validate", { code: "NOPE", tier: "full", period: "monthly" }, "post"],
  ["/api/pricing/lead", { email: "l@example.test", message: "hi" }, "post"],
  ["/api/pricing/newsletter", { email: "n@example.test" }, "post"],
  ["/api/pricing/partners/deals", {}, "post"],
  ["/api/pricing/affiliate/apply", { email: "a@example.test" }, "post"],
  ["/api/pricing/partners/apply", { email: "p@example.test" }, "post"],
  ["/api/pricing/edu/apply", { email: "e@example.test" }, "post"],
  ["/api/pricing/affiliate/magic-link", { email: "a@example.test" }, "post"],
  ["/api/pricing/partners/magic-link", { email: "p@example.test" }, "post"],
  ["/api/pricing/subscription/lite-module", { email: "x@example.test", module: "qsign" }, "post"],
  ["/api/pricing/checkout/session", { tier: "nonsense", period: "monthly" }, "post"],
  ["/api/pricing/checkout/status?intentId=нет-такого", {}, "get"],
];

/**
 * Перебор обязан быть ВЫШЕ самого щедрого предела на денежном пути, иначе
 * «отбить не удалось» означает «я не дострелил», а не «предела нет».
 * Замер 04.09.2026: было 45, а у ручки статуса выдачи предел 60/мин — она
 * попала в список беспредельных, имея ограничитель. Держать это число
 * больше максимума из checkout.ts / pricing.ts.
 */
const ПОПЫТОК = 70;

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
      for (const [путь, тело, метод] of РУЧКИ) {
        let отбили = false;
        for (let i = 0; i < ПОПЫТОК; i += 1) {
          const r =
            метод === "get"
              ? await request(app).get(путь)
              : await request(app).post(путь).send(тело as object);
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
