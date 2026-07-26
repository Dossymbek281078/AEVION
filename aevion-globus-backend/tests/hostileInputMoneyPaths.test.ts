import { describe, test, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Денежные и веерные эндпоинты не должны отвечать 500 на кривое тело запроса.
 *
 * Повод: 2026-07-26 нашлось, что `/checkout/session` роняется в 500, если в
 * `ownedModules` прислать число, null или не-массив — движок веера получал тело
 * без валидации. Любой кривой (или злонамеренный) клиент ронял ПУТЬ К ОПЛАТЕ.
 * Тот баг починен, но проверял я тогда только СВОИ поля. Здесь — все входы всех
 * четырёх ручек разом.
 *
 * Правило: 4xx — нормальный ответ на мусор, 5xx — нет. Сервер обязан пережить
 * любое тело; отказ должен быть осознанным, а не падением.
 */

const IMPORT_TIMEOUT_MS = 30_000;

/**
 * Стор подписок и лидов — в temp.
 *
 * Первый прогон этого файла записал 6 подписок с мусорными email
 * (`'; drop table users; --`, нулевые байты, 5000 символов) в РЕАЛЬНЫЙ
 * `data/subscriptions.jsonl` репозитория: чекаут со stub-провайдером провижинит
 * подписку, а тест слал `email` среди прочего мусора. Тест, который гадит в
 * рабочую копию, рано или поздно будет «починен» удалением.
 */
const TMP = mkdtempSync(join(tmpdir(), "aevion-hostile-"));
// Секрет нужен, чтобы 401 означал «токен отвергнут», а не «ручка сломана для
// всех»: без него отказ был бы неотличим от поломки, и тест ничего бы не доказал.
process.env.AUTH_JWT_SECRET = "hostile-test-secret-at-least-32-chars-long-000";
process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl");
process.env.LEADS_FILE = join(TMP, "leads.jsonl");
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

let appPromise: Promise<express.Express> | null = null;
function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = Promise.all([
      import("../src/routes/pricing"),
      import("../src/routes/checkout"),
    ]).then(([pricing, checkout]) => {
      const app = express();
      app.use(express.json());
      app.use("/api/pricing", pricing.pricingRouter);
      app.use("/api/pricing/checkout", checkout.checkoutRouter);
      return app;
    });
  }
  return appPromise;
}

/** Значения, которыми клиент может «случайно» заполнить любое поле. */
const JUNK: unknown[] = [
  42,
  null,
  true,
  { nested: { deep: true } },
  ["array", "where", "string", "expected"],
  "'; DROP TABLE users; --",
  "\u0000\uffff",
  "x".repeat(5000),
  -1,
  Number.NaN,
];

async function expectNo5xx(path: string, body: Record<string, unknown>) {
  const app = await getApp();
  const r = await request(app).post(path).send(body);
  expect(r.status, `5xx на ${path} c телом ${JSON.stringify(body).slice(0, 90)}`).toBeLessThan(500);
  return r;
}

describe("денежные пути переживают враждебный ввод", () => {
  test("POST /checkout/session — мусор в каждом поле по очереди", async () => {
    const fields = ["tierId", "period", "seats", "modules", "promoCode", "email", "currency", "method", "ownedModules", "lastPurchaseAt", "trial"];
    for (const field of fields) {
      for (const junk of JUNK) {
        await expectNo5xx("/api/pricing/checkout/session", { tierId: "medium", [field]: junk });
      }
    }
  }, IMPORT_TIMEOUT_MS);

  test("POST /pricing/quote — мусор в каждом поле по очереди", async () => {
    const fields = ["tierId", "period", "seats", "modules", "currency", "promoCode", "ownedModules", "lastPurchaseAt"];
    for (const field of fields) {
      for (const junk of JUNK) {
        await expectNo5xx("/api/pricing/quote", { tierId: "medium", [field]: junk });
      }
    }
  }, IMPORT_TIMEOUT_MS);

  test("POST /pricing/fan — мусор в каждом поле по очереди", async () => {
    for (const field of ["owned", "tierId", "currency", "lastPurchaseAt"]) {
      for (const junk of JUNK) {
        await expectNo5xx("/api/pricing/fan", { [field]: junk });
      }
    }
  }, IMPORT_TIMEOUT_MS);

  test("GET /pricing/fan/preview — мусор в currency", async () => {
    const app = await getApp();
    for (const junk of ["../../etc", "'; DROP", "USD;DROP", "x".repeat(500), ""]) {
      const r = await request(app).get(`/api/pricing/fan/preview?currency=${encodeURIComponent(junk)}`);
      expect(r.status, `5xx на currency=${junk.slice(0, 30)}`).toBeLessThan(500);
    }
  }, IMPORT_TIMEOUT_MS);

  test("🔴 подписка НЕ провижинится на мусорный email", async () => {
    // Прогон враждебных входов записал в стор подписки с email вида
    // `'; drop table users; --`, нулевыми байтами и строкой в 5000 символов:
    // чекаут со stub-провайдером провижинил на ЛЮБУЮ строку. Инъекции нет
    // (стор — JSONL), но это подписка, о которой владелец адреса не узнает, и
    // мусор в выручке.
    const { readFileSync, existsSync } = await import("node:fs");
    const store = process.env.SUBSCRIPTIONS_FILE as string;
    const bad = ["'; DROP TABLE users; --", "не-email", "x".repeat(300), " ", "@", "a@b"];
    for (const email of bad) {
      await expectNo5xx("/api/pricing/checkout/session", { tierId: "medium", email });
    }
    const written = existsSync(store)
      ? readFileSync(store, "utf8").split(/\r?\n/).filter(Boolean)
      : [];
    expect(written, `провижининг на мусорный email: ${written.join(" | ").slice(0, 200)}`).toEqual([]);

    // …а нормальный email по-прежнему провижинится.
    await expectNo5xx("/api/pricing/checkout/session", { tierId: "medium", email: "real.buyer@example.com" });
    const after = existsSync(store) ? readFileSync(store, "utf8").split(/\r?\n/).filter(Boolean) : [];
    expect(after.length).toBe(1);
    expect(after[0]).toContain("real.buyer@example.com");
  }, IMPORT_TIMEOUT_MS);

  test("публичные ручки с записью на диск: /lead и /promo/validate", async () => {
    // Обе публичны и обе пишут/читают: /lead кладёт лид в JSONL, /promo/validate
    // разбирает произвольный код. Их не проверял никто — а тело у них такое же
    // внешнее, как у чекаута.
    for (const field of ["name", "email", "company", "industry", "tier", "seats", "message", "source", "modules"]) {
      for (const junk of JUNK) {
        await expectNo5xx("/api/pricing/lead", { name: "x", email: "a@b.co", [field]: junk });
      }
    }
    for (const field of ["code", "tierId", "period"]) {
      for (const junk of JUNK) {
        await expectNo5xx("/api/pricing/promo/validate", { code: "AEVION20", tierId: "medium", [field]: junk });
      }
    }
  }, IMPORT_TIMEOUT_MS);

  test("GET /fan/me с кривым токеном и заголовками — 401, а не 500", async () => {
    // Единственная веерная ручка с авторизацией. Заголовок Authorization
    // приходит снаружи так же, как тело: пустой, обрезанный, не-JWT, чужой
    // алгоритм, гигантский. Ответ должен быть 401, а не падение.
    const app = await getApp();
    const headers = [
      undefined,
      "",
      "Bearer",
      "Bearer ",
      "Bearer not.a.jwt",
      "Bearer " + "x".repeat(4000),
      "Basic dXNlcjpwYXNz",
      // JWT с alg:none — классическая попытка обойти проверку подписи.
      // ВАЖНО про силу этой строки: снятие `algorithms: ["HS256"]` в роуте её
      // НЕ роняет — установленная версия jsonwebtoken сама отвергает alg:none
      // при переданном секрете. То есть здесь проверяется поведение библиотеки,
      // а пиннинг алгоритма сторожит отдельный tests/sharedSecretsHardening
      // (проверено мутацией: снятие пиннинга роняет именно его). Не считать эту
      // строку доказательством пиннинга.
      "Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6ImF0dGFja2VyQHRlc3QuZGV2In0.",
      "Bearer null",
    ];
    for (const h of headers) {
      const req = request(app).get("/api/pricing/fan/me");
      if (h !== undefined) req.set("Authorization", h);
      const r = await req;
      expect(r.status, `заголовок ${JSON.stringify(h)} дал ${r.status}`).toBe(401);
      // И ни при каких обстоятельствах не отдаём чужой веер.
      expect(JSON.stringify(r.body ?? {})).not.toMatch(/offers|ownedPaid/);
    }

    // Контрольная проверка: ВАЛИДНЫЙ токен проходит. Без неё все 401 выше
    // ничего не доказывают — ручка могла бы просто не работать ни для кого.
    const jwt = (await import("jsonwebtoken")).default;
    const good = jwt.sign(
      { sub: "u1", email: "valid@test.dev" },
      process.env.AUTH_JWT_SECRET as string,
      { algorithm: "HS256" },
    );
    const ok = await request(app).get("/api/pricing/fan/me").set("Authorization", `Bearer ${good}`);
    expect(ok.status, "валидный токен не прошёл — тогда 401 выше ничего не значат").toBe(200);
    expect(ok.body).toHaveProperty("offers");
  }, IMPORT_TIMEOUT_MS);

  test("пустое и не-объектное тело не роняют ручки", async () => {
    const app = await getApp();
    for (const path of ["/api/pricing/checkout/session", "/api/pricing/quote", "/api/pricing/fan"]) {
      for (const body of [{}, [], "строка", 0]) {
        const r = await request(app).post(path).send(body as never);
        expect(r.status, `5xx на ${path} с телом ${JSON.stringify(body)}`).toBeLessThan(500);
      }
    }
  }, IMPORT_TIMEOUT_MS);
});
