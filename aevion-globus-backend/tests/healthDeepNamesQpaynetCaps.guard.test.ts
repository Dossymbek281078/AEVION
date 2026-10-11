import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";

/**
 * /api/health/deep обязан НАЗЫВАТЬ два предела QPayNet, и названное
 * обязано совпадать с тем, что РУЧКИ ДЕЙСТВИТЕЛЬНО ПРИМЕНЯЮТ.
 *
 * Повод, а не гипотеза. 11.10.2026 при сдаче вердикта по QPayNet выяснилось,
 * что подтвердить на проде два правила нечем:
 *   • «зачисление без источника денег закрыто» — ручка за входом, а
 *     авторизованная проба была бы проверкой дыры дырой: окажись дыра
 *     открытой, проба начислила бы себе настоящие деньги;
 *   • «кошельков не больше предела» — предел берётся из QPAYNET_MAX_WALLETS,
 *     и узнать его снаружи можно было ТОЛЬКО заведя столько кошельков,
 *     то есть создав на проде настоящие записи.
 * Спросить переменную у сервиса тоже не удалось: railway в этом worktree
 * без привязанного проекта (код 1 = «не спросил», а не «не задана»).
 *
 * Поэтому оба факта теперь печатает ручка состояния — чтением, без денег.
 *
 * 🔴 ЧЕГО ЭТОТ СТОРОЖ НЕ ДЕЛАЕТ. Он НЕ поднимает сам /api/health/deep:
 * src/index.ts зовёт app.listen на уровне модуля и не экспортирует app,
 * поэтому запрос к этой ручке в тесте поднял бы слушателя и воркеры.
 * Значит половина про index.ts здесь — ТЕКСТОВАЯ, и это её слабое место
 * (текст о вещи неотличим от вещи). Зато вторая половина — настоящие
 * запросы к ручкам qpaynet: они доказывают, что ЗНАЧЕНИЯ, которые ручка
 * состояния берётся печатать, и есть те, по которым отказывают кошельки
 * и зачисление. Без этой половины сторож проверял бы замысел, а не работу.
 */

// ≥ 32 знаков и не с «dev-»: в production getJwtSecret() бракует слабый секрет
// и бросает исключение — тогда ручка отвечает 401 и до проверяемой ветки дело не доходит.
const SECRET = "test-secret-health-deep-caps-qpaynet-2026";
let запросы: string[] = [];
let счётКошельков = 0;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      запросы.push(String(sql));
      if (/COUNT\(\*\)/i.test(String(sql))) return { rows: [{ n: счётКошельков }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async (sql: string) => {
        запросы.push(String(sql));
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    })),
  }),
}));

const модуль = async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  return await import("../src/routes/qpaynet");
};

const приложение = async () => {
  const { qpaynetRouter } = await модуль();
  const a = express();
  a.use(express.json());
  a.use("/api/qpaynet", qpaynetRouter);
  return a;
};

const токен = () =>
  jwt.sign({ sub: "u_проба", email: "probe@aevion.app" }, SECRET, {
    algorithm: "HS256",
    expiresIn: "10m",
  });

const ИСХОДНЫЙ_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  запросы = [];
  счётКошельков = 0;
  delete process.env.QPAYNET_FUNDING_PROVIDER;
  delete process.env.QPAYNET_MAX_WALLETS;
  delete process.env.QPAYNET_ADMIN_EMAILS;
  if (ИСХОДНЫЙ_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ИСХОДНЫЙ_NODE_ENV;
  vi.resetModules();
});

describe("QPayNet: пределы, которые печатает ручка состояния, — те же, по которым отказывают ручки", () => {
  it("предел кошельков из экспорта — ровно тот, что назвала ручка в отказе", async () => {
    process.env.QPAYNET_MAX_WALLETS = "3"; // не умолчание: иначе «5» могло быть зашито
    const { MAX_WALLETS_PER_OWNER } = await модуль();
    expect(MAX_WALLETS_PER_OWNER).toBe(3);

    счётКошельков = 3;
    const r = await request(await приложение())
      .post("/api/qpaynet/wallets")
      .set("Authorization", "Bearer " + токен())
      .send({ name: "probe-user-89" });

    expect(r.status).toBe(403);
    expect(r.body.error).toBe("wallet_limit_reached");
    // главное утверждение: печатать это значение в /health правдиво
    expect(r.body.limit).toBe(MAX_WALLETS_PER_OWNER);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: ниже предела та же ручка НЕ отказывает по этому признаку", async () => {
    process.env.QPAYNET_MAX_WALLETS = "3";
    счётКошельков = 2;
    const r = await request(await приложение())
      .post("/api/qpaynet/wallets")
      .set("Authorization", "Bearer " + токен())
      .send({ name: "probe-user-89" });
    expect(r.body?.error).not.toBe("wallet_limit_reached");
  });

  it("🔴 в production признак приёма денег ЛОЖЕН, даже если переменная говорит «connected»", async () => {
    process.env.NODE_ENV = "production";
    process.env.QPAYNET_FUNDING_PROVIDER = "connected";
    const { приёмДенегПодключён } = await модуль();
    expect(приёмДенегПодключён()).toBe(false);

    const r = await request(await приложение())
      .post("/api/qpaynet/deposit")
      .set("Authorization", "Bearer " + токен())
      .send({ walletId: "w_проба", amount: 1000 });

    expect(r.status).toBe(403);
    expect(r.body.error).toBe("funding_not_connected");
    expect(запросы.some((s) => /balance\s*=\s*balance/i.test(s))).toBe(false);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: вне production тот же признак ИСТИНЕН и отказ уже не этот", async () => {
    process.env.NODE_ENV = "test";
    process.env.QPAYNET_FUNDING_PROVIDER = "connected";
    const { приёмДенегПодключён } = await модуль();
    expect(приёмДенегПодключён()).toBe(true);

    const r = await request(await приложение())
      .post("/api/qpaynet/deposit")
      .set("Authorization", "Bearer " + токен())
      .send({ walletId: "w_проба", amount: 1000 });
    expect(r.body?.error).not.toBe("funding_not_connected");
  });
});

describe("QPayNet: пустой список админов в production НЕ делает админом любого вошедшего", () => {
  /*
   * 🔴 Найдено мутацией 11.10. Ветвь `if (NODE_ENV === "production") return false`
   * внутри isAdmin() была закрыта ТОЛЬКО тестом-копией: tests/qpaynetAdminGate.test.ts
   * объявляет свою функцию isAdmin и проверяет её, а не ту, что в проде. Её шапка
   * говорит прямо: «The duplication is intentional today because qpaynet.ts is a
   * 4000-line module and exporting isAdmin would broaden its public surface» — и
   * обещает «if anyone changes the impl in qpaynet.ts these tests will fail».
   * Замер: я заменил эту строку в src/routes/qpaynet.ts на `if (false) return false;`
   * — qpaynetAdminGate дал 6 из 6 ЗЕЛЁНЫХ, qpaynetDepositsAudit тоже зелёный.
   * То есть у прав администратора (KYC, отказ выплат) не было ни одного сторожа,
   * который делает ЗАПРОС. Этот — делает, и копию ничью не правит.
   */
  const ПУТЬ = "/api/qpaynet/admin/deposits/audit";

  it("🔴 список не задан + production -> 403, а не доступ", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.QPAYNET_ADMIN_EMAILS;
    const r = await request(await приложение())
      .get(ПУТЬ)
      .set("Authorization", "Bearer " + токен());
    expect(r.status).toBe(403);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: вне production тот же пустой список даёт доступ (403 не всегда)", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.QPAYNET_ADMIN_EMAILS;
    const r = await request(await приложение())
      .get(ПУТЬ)
      .set("Authorization", "Bearer " + токен());
    expect(r.status).not.toBe(403);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: список задан и чужая почта -> 403 даже вне production", async () => {
    process.env.NODE_ENV = "test";
    process.env.QPAYNET_ADMIN_EMAILS = "boss@aevion.app";
    const r = await request(await приложение())
      .get(ПУТЬ)
      .set("Authorization", "Bearer " + токен());
    expect(r.status).toBe(403);
  });
});

describe("ТЕКСТОВАЯ половина: ручка состояния действительно называет оба предела", () => {
  const источник = () => readFileSync("src/index.ts", "utf8");

  it("прибор видит предмет: файл прочитан и в нём есть env-блок health", () => {
    const s = источник();
    expect(s.length).toBeGreaterThan(10000);
    expect(s).toContain("nodeEnv: process.env.NODE_ENV");
  });

  it("оба поля печатаются и берутся из ЭКСПОРТА, а не из своей копии правила", () => {
    const s = источник();
    expect(s).toContain("qpaynetFundingConnected: приёмДенегПодключён(),");
    expect(s).toContain("qpaynetMaxWallets: MAX_WALLETS_PER_OWNER,");
    expect(s).toContain("qpaynetAdminEmailsSet:");
    // своя копия правила — именно то, чего нельзя: тогда /health говорил бы
    // про себя, а не про ручки
    expect(s).not.toContain('qpaynetFundingConnected: process.env.QPAYNET_FUNDING_PROVIDER');
    expect(s).not.toContain('qpaynetMaxWallets: Number(process.env.QPAYNET_MAX_WALLETS');
  });

  it("КОНТРОЛЬ ПРИБОРА: выдуманное поле в том же файле НЕ находится", () => {
    expect(источник()).not.toContain("qpaynetЗаведомоНетТакогоПоля");
  });
});
