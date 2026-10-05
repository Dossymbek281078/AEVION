import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сторож: на вопрос «кто у нас основная касса» платформа даёт ОДИН ответ.
 *
 * 🔴 ЗАМЕР 29.09.2026 на живом проде — три ручки, два разных ответа:
 *
 *   /api/pricing/checkout/healthz → primaryProvider: "lemonsqueezy"
 *   /api/payments/health          → lemonsqueezy.primary: true
 *   /api/revenue/health           → gumroad.primary: **true**
 *
 * Третья отвечала ЛИТЕРАЛОМ, оставшимся с тех времён, когда живым процессингом
 * действительно был Gumroad. Цена не косметическая: у Gumroad на тот день не
 * настроено ни одной из 50 продаваемых позиций (`gumroad.sellable.missing` —
 * 50 из 50), то есть отчёт называл основной кассой того, кто не может продать
 * ничего, а читает этот отчёт человек, принимающий решения о деньгах.
 *
 * Почему сторож нужен, хотя дефект «уже чинили»: в `payments.ts` его однажды
 * починили и в комментарии прямо назвали причину — «второй способ отвечать на
 * тот же вопрос», — а лечение сделали КОПИЕЙ выражения из `checkout.ts`. Копий
 * стало три, и третья разошлась молча. Значит охранять надо не текст выражения,
 * а СОГЛАСИЕ ответов: только оно ловит появление четвёртой копии.
 *
 * Проверяется поведение НАСТОЯЩИХ маршрутов, а не общая функция: если кто-то
 * снова впишет литерал в одну из ручек, функция останется верной, а ручка
 * соврёт — ровно так это и случилось.
 */

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));

const сохранено = { ...process.env };

const { checkoutRouter } = await import("../src/routes/checkout");
const { paymentsRouter } = await import("../src/routes/payments");
const { revenueRouter } = await import("../src/routes/revenue");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  a.use("/api/payments", paymentsRouter);
  a.use("/api/revenue", revenueRouter);
  return a;
}

/** Кого называет основной каждая из трёх ручек. */
async function ответы(): Promise<Record<string, string>> {
  const app = приложение();

  const hz = await request(app).get("/api/pricing/checkout/healthz");
  expect(hz.status, "healthz обязан отвечать").toBe(200);

  const pay = await request(app).get("/api/payments/health");
  expect(pay.status, "/api/payments/health обязан отвечать").toBe(200);

  const rev = await request(app).get("/api/revenue/health");
  expect(rev.status, "/api/revenue/health обязан отвечать").toBe(200);

  const изФлагов = (п: Record<string, { primary?: boolean }> | undefined) => {
    const найдено = Object.entries(п ?? {})
      .filter(([, v]) => v?.primary === true)
      .map(([k]) => k);
    // 🔴 05.10.2026: НОЛЬ основных теперь ЗАКОННЫЙ исход, а двое — по-прежнему
    // поломка. Прежде здесь требовалось «ровно 1», и это закрепляло допущение, что
    // рабочая касса есть всегда. На проде она может отсутствовать: у Lemon Squeezy
    // нет секрета вебхука, у Gumroad не настроено ни одного товара (замер 05.10: 0 из
    // 30). Тогда честный ответ — «none», то есть ни одного основного, и требование
    // «ровно 1» заставляло бы код называть основной мёртвую кассу.
    //
    // Настоящее требование этого сторожа другое и оно сохранено: три ручки обязаны
    // ОТВЕЧАТЬ ОДНО И ТО ЖЕ. Его проверяет сравнение ниже.
    expect(найдено.length, `двое основных — ответ обязан быть один: ${найдено.join(", ")}`).toBeLessThanOrEqual(1);
    // Ноль флагов — это и есть «none». Без приведения ручка со флагами отвечала
    // undefined, а healthz строкой "none", и сторож видел спор там, где согласие.
    return найдено[0] ?? "none";
  };

  return {
    healthz: hz.body.primaryProvider,
    // У этой ручки провайдеры лежат в КОРНЕ ответа, а не под `providers`:
    // форма другая, вопрос тот же. Сторож обязан читать форму каждой ручки,
    // иначе «ноль основных» получится от собственной ошибки чтения.
    payments: изФлагов(pay.body),
    revenue: изФлагов(rev.body.providers),
  };
}

beforeEach(() => {
  process.env.LEMON_SQUEEZY_API_KEY = "ls-key";
  process.env.LEMON_SQUEEZY_STORE_ID = "42";
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "ls-secret";
  process.env.GUMROAD_ACCESS_TOKEN = "gr-token";
});

afterAll(() => {
  for (const k of ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_WEBHOOK_SECRET", "GUMROAD_ACCESS_TOKEN"]) {
    if (сохранено[k] === undefined) delete process.env[k];
    else process.env[k] = сохранено[k] as string;
  }
});

describe("кто основная касса", () => {
  test("все три ручки называют Lemon Squeezy, когда выдача у неё работает", async () => {
    const о = await ответы();
    expect(о.healthz).toBe("lemonsqueezy");
    expect(о.payments, "/api/payments/health разошёлся с healthz").toBe("lemonsqueezy");
    expect(о.revenue, "/api/revenue/health разошёлся с healthz — именно это было 29.09").toBe("lemonsqueezy");
  });

  test("КОНТРОЛЬ: без секрета вебхука все три переключаются на Gumroad вместе", async () => {
    // Без секрета Lemon Squeezy отвечает кассе 200 и молча игнорирует событие:
    // деньги списаны, доступ не выдан. Значит основной она быть не может.
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    // Gumroad получает товар: без него он продать не может, и честный ответ был бы
    // «none» (замер прода 05.10: у Gumroad 0 товаров из 30).
    process.env.GUMROAD_DEFAULT_PERMALINK = "aevion";

    const о = await ответы();
    expect(о.healthz).toBe("gumroad");
    expect(о.payments).toBe("gumroad");
    expect(о.revenue).toBe("gumroad");
  });

  test("КОНТРОЛЬ: ответы совпадают в любом состоянии настроек, а не только в одном", async () => {
    const состояния: { имя: string; готовь: () => void }[] = [
      { имя: "всё задано", готовь: () => {} },
      { имя: "нет секрета вебхука", готовь: () => delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET },
      { имя: "нет магазина", готовь: () => delete process.env.LEMON_SQUEEZY_STORE_ID },
      { имя: "нет ключа", готовь: () => delete process.env.LEMON_SQUEEZY_API_KEY },
      { имя: "пустые строки вместо значений", готовь: () => { process.env.LEMON_SQUEEZY_API_KEY = "   "; } },
    ];
    for (const с of состояния) {
      process.env.LEMON_SQUEEZY_API_KEY = "ls-key";
      process.env.LEMON_SQUEEZY_STORE_ID = "42";
      process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "ls-secret";
      с.готовь();

      const о = await ответы();
      expect(new Set(Object.values(о)).size, `состояние «${с.имя}»: ручки назвали разное — ${JSON.stringify(о)}`).toBe(1);
    }
  });
});
