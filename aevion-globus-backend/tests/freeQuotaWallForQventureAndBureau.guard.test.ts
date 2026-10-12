import { describe, test, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: бесплатная норма действий у QVenture и Бюро — СПИТ по умолчанию, а
 * включается одним числом, и отказ несёт то поле, которое читает витрина.
 *
 * ПОВОД (замеры прода 12.10.2026, окно user-d7). Витрина продаёт пять
 * приложений; платная стена включена у ОДНОГО (multichat-engine) —
 * `/api/paywall/policy`: 44 модуля, `enforcedCount: 6`, и из продаваемых там
 * только Multichat. Гостю при этом открыто всё: `POST /api/qventure/analyze` →
 * 400 «name is required», `POST /api/bureau/verify/start` → 400
 * «declared_name_required» (контроль: выдуманный путь → 404, значит отвечали
 * настоящие ручки). В `routes/qventure.ts` слов `tier` и `resolvePlan` было 0
 * вхождений при 13 вхождениях `analyze` — продукт не смотрел на тариф вовсе.
 * То есть плательщик получал ровно то же, что гость.
 *
 * ПОЧЕМУ НОРМА, А НЕ СТЕНА. Стена закрывает модуль целиком и убирает
 * бесплатный вход, а первых продаж ещё нет. Норма закрывает ДЕЙСТВИЕ: смотреть
 * бесплатно, считать своё — по счёту. Механизм уже написан
 * (`lib/freeActionQuota.ts`, работает у QRight и коуча) и СПИТ, пока действие
 * не названо в `PAID_ACTIONS`, поэтому выкатка ничего не меняет до слова
 * основателя — ему остаётся назвать число.
 *
 * ЧТО ОХРАНЯЕТСЯ:
 *   1. переменная не задана → поведение ПРЕЖНЕЕ (контроль: ни одного 402);
 *   2. действие названо и норма 2 → третий запрос гостя получает 402;
 *   3. в теле 402 есть `upgradeUrl` — ИМЕННО это поле читает
 *      `frontend/.../qventure/batch/page.tsx`, и проверяется это чтением
 *      ЕГО исходника, а не моей памятью о нём;
 *   4. неверный ввод НЕ съедает бесплатную попытку (проверка стоит после
 *      разбора тела: `учестьДействие` считает действие сразу, SQL `count + 1`);
 *   5. платящий проходит всегда, не трогая счётчик.
 *
 * ГРАНИЦА: база подменена счётчиком в памяти — проверяется, какие запросы
 * уходят и что отвечает ручка, а не поведение настоящего Postgres. Бюро здесь
 * не поднимается (у него свой KYC-провайдер); его подключение проверено тем же
 * способом по исходнику — отдельным утверждением ниже.
 */

/*
 * Платящий определяется ПЛАНОМ, а план — записью подписки по почте из токена
 * (resolveUserPlan), а не полем tier в токене. Первая версия этого теста
 * подписывала токен с `tier: "full"` и получила 402: ошибся прибор, не код.
 * Поэтому здесь настоящая запись подписки в своём файле.
 */
const каталогПодписок = mkdtempSync(join(tmpdir(), "aevion-quota-"));
process.env.SUBSCRIPTIONS_FILE = join(каталогПодписок, "subscriptions.jsonl");
writeFileSync(
  process.env.SUBSCRIPTIONS_FILE,
  JSON.stringify({
    id: "sub_payer", ts: new Date().toISOString(), email: "payer@test.aev",
    tierId: "medium", termMonths: 3, seats: 1, modules: [], trialDays: 0, source: "test",
  }) + String.fromCharCode(10),
  "utf8",
);
process.env.AUTH_JWT_SECRET = "test-secret-dlya-storozha-normy-32-znaka-i-bolshe";

const { счётчик, mockQuery, mockCouncil } = vi.hoisted(() => ({
  счётчик: new Map<string, number>(),
  mockQuery: vi.fn(),
  mockCouncil: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureQVentureTables", () => ({
  ensureQVentureTables: vi.fn(),
  isQVentureDbReady: () => true,
  getQVentureDbError: () => null,
}));
vi.mock("../src/lib/qventure/lenses", () => ({ runCouncil: mockCouncil }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
// Остальные экспорты — настоящие: норма считает гостя через clientIp (12.10.2026).
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { qventureRouter } = await import("../src/routes/qventure");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/qventure", qventureRouter);
  return a;
}

let номер = 0;
/** Каждый запрос — новый план, иначе сработает ответ по готовому разбору. */
function разбор() {
  номер += 1;
  return request(приложение())
    .post("/api/qventure/analyze")
    .send({
      name: "Проба нормы " + номер,
      description: "Описание идеи достаточной длины для проверки нормы действий, " + номер,
      stage: "seed",
      sector: "other",
    });
}

beforeEach(() => {
  счётчик.clear();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const текст = String(sql);
    // Счёт бесплатных действий: та же строка, что в freeActionQuota.
    if (/INSERT INTO "FreeActionUsage"/.test(текст)) {
      const ключ = String(params?.[0]) + "|" + String(params?.[1]) + "|" + String(params?.[2]);
      const было = счётчик.get(ключ) ?? 0;
      счётчик.set(ключ, было + 1);
      return { rows: [{ count: было + 1 }] };
    }
    return { rows: [] };
  });
  mockCouncil.mockReset();
  mockCouncil.mockResolvedValue({ lenses: [], memo: "тест", aiProvider: "stub", aiUsed: false });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.PAID_ACTIONS;
  delete process.env.FREE_QVENTURE_ANALYZE_PER_MONTH;
});

afterEach(() => {
  delete process.env.PAID_ACTIONS;
  delete process.env.FREE_QVENTURE_ANALYZE_PER_MONTH;
});

afterAll(() => {
  // Убираем за собой: иначе каждый прогон оставляет каталог в TEMP.
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.AUTH_JWT_SECRET;
  try { rmSync(каталогПодписок, { recursive: true, force: true }); } catch { /* уже нет */ }
});

describe("норма действий у QVenture", () => {
  test("КОНТРОЛЬ: переменная не задана — поведение прежнее, ни одного 402", async () => {
    const коды: number[] = [];
    for (let i = 0; i < 4; i += 1) коды.push((await разбор()).status);
    expect(коды.some((c) => c === 402), "норма сработала при спящем механизме: " + коды).toBe(false);
    expect(
      [...счётчик.keys()].length,
      "спящий механизм всё равно ходил в счётчик — лишние запросы к базе на каждом разборе",
    ).toBe(0);
  });

  test("названо действие и норма 2 — третий запрос гостя получает 402", async () => {
    process.env.PAID_ACTIONS = "qventure_analyze";
    process.env.FREE_QVENTURE_ANALYZE_PER_MONTH = "2";

    const первый = await разбор();
    const второй = await разбор();
    const третий = await разбор();

    expect(первый.status, "первый разбор в норме, а получил отказ").not.toBe(402);
    expect(второй.status, "второй разбор в норме, а получил отказ").not.toBe(402);
    expect(третий.status, "третий разбор прошёл при норме 2 — норма не работает").toBe(402);
    expect(третий.body.error).toBe("free_quota_exceeded");
    expect(третий.body.freePerMonth).toBe(2);
    expect(третий.body.module).toBe("qventure");
  });

  test("в отказе есть поле upgradeUrl — ровно то, которое читает витрина", async () => {
    process.env.PAID_ACTIONS = "qventure_analyze";
    process.env.FREE_QVENTURE_ANALYZE_PER_MONTH = "0";
    const отказ = await разбор();
    expect(отказ.status).toBe(402);

    // Связь ДВУХ ПОЛОВИН: имя поля берём из исходника страницы, а не из памяти.
    const страница = readFileSync(
      join(
        __dirname, "..", "..",
        "frontend", "src", "app", "qventure", "batch", "page.tsx",
      ),
      "utf8",
    );
    const читаемоеПоле = /aj\?\.(\w+)\s*===\s*"string"\)\s*set(\w+)/.exec(страница);
    expect(
      страница.includes("upgradeUrl"),
      "витрина перестала читать upgradeUrl — сторож надо переписать под новое имя",
    ).toBe(true);
    expect(читаемоеПоле?.[1] ?? "upgradeUrl").toBe("upgradeUrl");
    expect(
      typeof отказ.body.upgradeUrl,
      "отказ не несёт upgradeUrl — человек увидит отказ без кнопки, куда платить",
    ).toBe("string");
    expect(String(отказ.body.upgradeUrl)).toContain("/pricing");
  });

  test("неверный ввод НЕ съедает бесплатную попытку", async () => {
    process.env.PAID_ACTIONS = "qventure_analyze";
    process.env.FREE_QVENTURE_ANALYZE_PER_MONTH = "1";

    const пустой = await request(приложение()).post("/api/qventure/analyze").send({});
    expect(пустой.status, "пустое тело прошло как разбор").toBe(400);
    expect(
      [...счётчик.values()].reduce((a, b) => a + b, 0),
      "опечатка в теле запроса списала бесплатную попытку",
    ).toBe(0);

    const годный = await разбор();
    expect(годный.status, "после неверного ввода годный разбор получил отказ").not.toBe(402);
  });

  test("платящий проходит всегда и счётчика не трогает", async () => {
    process.env.PAID_ACTIONS = "qventure_analyze";
    process.env.FREE_QVENTURE_ANALYZE_PER_MONTH = "0";
    const jwt = (await import("jsonwebtoken")).default;
    const токен = jwt.sign(
      { email: "payer@test.aev", sub: "payer@test.aev" },
      process.env.AUTH_JWT_SECRET as string,
      { algorithm: "HS256", expiresIn: "1h" },
    );
    const r = await request(приложение())
      .post("/api/qventure/analyze")
      .set("Authorization", "Bearer " + токен)
      .send({
        name: "План платящего",
        description: "Описание идеи достаточной длины для проверки прохода платящего",
      });
    expect(r.status, "платящий получил отказ по норме").not.toBe(402);
    expect(
      [...счётчик.values()].reduce((a, b) => a + b, 0),
      "платящий всё равно сходил в счётчик — лишний запрос к базе на каждом действии",
    ).toBe(0);
  });

  test("Бюро подключено тем же механизмом и тем же способом", () => {
    const бюро = readFileSync(join(__dirname, "..", "src", "routes", "bureau.ts"), "utf8");
    expect(бюро, "в Бюро нет вызова учёта действия").toContain('учестьДействие(req, "bureau_verify")');
    expect(бюро, "в Бюро нет отказа по норме").toContain('отказПоНорме(res, "bureau"');
    // Порядок: имя требуется ДО учёта, иначе пустое тело съедает попытку.
    const iИмя = бюро.indexOf("declared_name_required");
    const iУчёт = бюро.indexOf('учестьДействие(req, "bureau_verify")');
    expect(iИмя, "проверка имени не найдена").toBeGreaterThan(0);
    expect(
      iИмя < iУчёт,
      "учёт стоит раньше проверки имени — пустое тело списывает бесплатную попытку",
    ).toBe(true);
  });
});
