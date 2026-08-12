/**
 * Ручки /api/pricing/provisioning — history, stats, healthz.
 *
 * Тестов на них не было, и это часть причины, по которой пропажу не заметили:
 * 15.05.2026 коммит e0f5a2327, возвращавший два ДРУГИХ роутера после
 * squash-мержа, заодно снял импорт и монтирование этого. Страница
 * /pricing/provisioning продолжала открываться и три месяца молча показывала
 * пустоту — ошибки на экране нет, а тест, который бы покраснел, отсутствовал.
 *
 * Поэтому тут проверяется не только «отвечает 200», но и то, ради чего страница
 * существует: сводка по тарифам и история по email.
 *
 * Отдельно закреплено, что byTier содержит ВСЕ семь текущих тарифов. В версии
 * от 14.05 их было четыре (free/pro/business/enterprise); lite, medium и full
 * появились позже. Дословный перенос старого кода дал бы отчёт, молча теряющий
 * три тарифа — на странице, которая существует ради ответа «кому что выдано».
 *
 * SUBSCRIPTIONS_FILE подменяется на временный файл ДО импорта модуля: путь
 * читается через subsFile() при каждом вызове, но общий data/subscriptions.jsonl
 * трогать нельзя — на нём стоит боевая выдача доступов.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "aevion-prov-"));
const file = join(dir, "subscriptions.jsonl");

const NOW = Date.now();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const DAY = 86400000;

/** Записи специально разные: тарифы, свежесть, триал, чужой email. */
const ROWS = [
  { id: "s1", ts: iso(1 * DAY), email: "buyer@example.com", tierId: "full", period: "monthly", seats: 1, modules: [], trialDays: 0, validUntil: new Date(NOW + 30 * DAY).toISOString(), source: "gumroad" },
  { id: "s2", ts: iso(3 * DAY), email: "buyer@example.com", tierId: "lite", period: "monthly", seats: 1, modules: [], trialDays: 7, validUntil: new Date(NOW + 5 * DAY).toISOString(), source: "stub" },
  { id: "s3", ts: iso(40 * DAY), email: "other@example.com", tierId: "medium", period: "annual", seats: 3, modules: ["qright"], trialDays: 0, validUntil: new Date(NOW - 1 * DAY).toISOString(), source: "lemonsqueezy" },
];

let app: express.Express;
let mod: typeof import("../src/routes/provisioning");

beforeAll(async () => {
  process.env.SUBSCRIPTIONS_FILE = file;
  // третья строка намеренно битая: одна порча не должна прятать остальные
  writeFileSync(file, ROWS.map((r) => JSON.stringify(r)).join("\n") + "\n{ битая строка }\n", "utf8");
  mod = await import("../src/routes/provisioning");
  app = express();
  app.use("/api/pricing/provisioning", mod.provisioningRouter);
  // 60с, а не стандартные 10: модуль тянет тяжёлые зависимости, и на этой
  // машине один только import занимает ~13с. Со стандартным таймаутом тест
  // краснеет по причине, не имеющей отношения к проверяемому, — а такой
  // красный со временем начинают игнорировать.
}, 60_000);

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  rmSync(dir, { recursive: true, force: true });
});

describe("provisioning: чтение хранилища", () => {
  test("читает все записи, новые первыми, битую строку пропускает", () => {
    const all = mod.readSubscriptions();
    expect(all.length).toBe(3);
    expect(all[0].id).toBe("s1");
    expect(all[2].id).toBe("s3");
  });

  test("фильтрует по email без учёта регистра", () => {
    expect(mod.readSubscriptions({ email: "BUYER@example.com" }).length).toBe(2);
    expect(mod.readSubscriptions({ email: "нет@такого.com" }).length).toBe(0);
  });
});

describe("provisioning: сводка", () => {
  /**
   * Проверять объявление тарифов НАДО НА ПУСТОМ хранилище.
   *
   * Первая версия этого теста считала ключи на обычных данных и проходила по
   * неверной причине: `byTier[s.tierId] = (byTier[s.tierId] ?? 0) + 1`
   * дописывает недостающий ключ на лету, а в наборе как раз есть lite, medium
   * и full. Мутационная проверка это показала — я урезал объявление до четырёх
   * тарифов, и все тесты остались зелёными.
   *
   * На пустом хранилище дописывать нечего, поэтому видно ровно то, что
   * объявлено. Ради этого страница и существует: тариф, по которому сегодня
   * никто не купил, обязан показываться нулём, а не исчезать из отчёта.
   */
  test("byTier объявляет ВСЕ семь тарифов даже когда подписок нет", () => {
    const emptyFile = join(dir, "empty.jsonl");
    writeFileSync(emptyFile, "", "utf8");
    const prev = process.env.SUBSCRIPTIONS_FILE;
    process.env.SUBSCRIPTIONS_FILE = emptyFile;
    try {
      const agg = mod.aggregateSubscriptions();
      expect(agg.total).toBe(0);
      expect(Object.keys(agg.byTier).sort()).toEqual(
        ["business", "enterprise", "free", "full", "lite", "medium", "pro"],
      );
    } finally {
      process.env.SUBSCRIPTIONS_FILE = prev;
    }
  });

  test("считает по тарифам верно", () => {
    const agg = mod.aggregateSubscriptions();
    expect(agg.total).toBe(3);
    expect(agg.byTier.full).toBe(1);
    expect(agg.byTier.lite).toBe(1);
    expect(agg.byTier.medium).toBe(1);
    expect(agg.byTier.free).toBe(0);
  });

  test("за 7 дней — только свежие, а не всё подряд", () => {
    expect(mod.aggregateSubscriptions().last7d).toBe(2);
  });

  test("активным триалом считается только не истёкший", () => {
    expect(mod.aggregateSubscriptions().trialsActive).toBe(1);
  });
});

describe("provisioning: ручки", () => {
  test("healthz отвечает и говорит, где хранилище", async () => {
    const r = await request(app).get("/api/pricing/provisioning/healthz");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.storageExists).toBe(true);
  });

  test("stats отдаёт сводку, а не пустоту", async () => {
    const r = await request(app).get("/api/pricing/provisioning/stats");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.recent.length).toBe(3);
  });

  test("history без email — 400 с подсказкой, а не пустой список", async () => {
    const r = await request(app).get("/api/pricing/provisioning/history");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("missing_email");
  });

  test("history с мусором вместо email — 400", async () => {
    const r = await request(app).get("/api/pricing/provisioning/history?email=abc");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_email");
  });

  test("history отдаёт записи этого email и маскирует адрес", async () => {
    const r = await request(app).get("/api/pricing/provisioning/history?email=buyer@example.com");
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(2);
    expect(r.body.email).toBe("buy***@example.com");
    // адрес не должен утечь в открытом виде ни в одном поле
    expect(JSON.stringify(r.body)).not.toContain("buyer@example.com");
  });

  test("истёкшая подписка помечена expired, действующая — active", async () => {
    const r = await request(app).get("/api/pricing/provisioning/history?email=other@example.com");
    expect(r.body.items[0].status).toBe("expired");
    const b = await request(app).get("/api/pricing/provisioning/history?email=buyer@example.com");
    expect(b.body.items.find((i: { id: string }) => i.id === "s1").status).toBe("active");
  });
});

/**
 * Сторож на ТУ САМУЮ поломку.
 *
 * Тесты выше поднимают роутер сами и потому прошли бы даже 15.05.2026 — в день,
 * когда ручки перестали существовать для внешнего мира. Сломан был не роутер,
 * а его монтирование в index.ts, и поймать это может только проверка монтажа.
 *
 * Читаем исходник, а не поднимаем приложение: import index.ts запускает сервер,
 * открывает порт и тянет всю платформу — в тесте это дороже и капризнее, чем
 * прочитать одну строку.
 */
describe("provisioning: роутер действительно смонтирован", () => {
  test("index.ts импортирует и монтирует provisioningRouter", () => {
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    expect(src).toContain('from "./routes/provisioning"');
    expect(src).toMatch(/app\.use\(\s*["']\/api\/pricing\/provisioning["']\s*,\s*provisioningRouter\s*\)/);
  });

  test("путь монтирования совпадает с тем, что обещает openapi", () => {
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    for (const p of ["history", "stats", "healthz"]) {
      expect(src).toContain(`"/api/pricing/provisioning/${p}"`);
    }
  });
});
