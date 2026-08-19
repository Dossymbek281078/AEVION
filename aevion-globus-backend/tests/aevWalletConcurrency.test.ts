// Кошелёк AEV под параллельной нагрузкой.
//
// Найдено живым залпом 2026-08-10: десять ОДНОВРЕМЕННЫХ списаний по 100
// при балансе 100 проходили ВСЕ ДЕСЯТЬ — каждому возвращалось ok:true,
// баланс становился 0, а в реестре оставалась одна запись из десяти.
// Причина: обработчик читал файл кошельков, проверял баланс и записывал
// файл тремя отдельными await, и между проверкой и записью успевал
// вклиниться соседний запрос. Отказа не было ни одного — модуль-потребитель
// просто выдавал товар десять раз за одну оплату.
//
// Хранилище у AEV файловое и в проде (Postgres в этом роутере только в
// планах), поэтому это не «особенность dev-режима».
//
// Важно: десять curl-процессов гонку НЕ создают — на Windows они стартуют
// по очереди, и первая попытка воспроизведения дала ложное «всё хорошо».
// Залп должен идти из одного процесса, как здесь.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { aevRouter } from "../src/routes/aev";

let app: express.Express;
let dataDir: string;
let prevDataDir: string | undefined;
let prevNodeEnv: string | undefined;

beforeEach(() => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  prevNodeEnv = process.env.NODE_ENV;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-aev-wallet-"));
  process.env.AEVION_DATA_DIR = dataDir;
  // Анонимный mint разрешён вне прода — это путь заполнения баланса в смоуках.
  process.env.NODE_ENV = "test";

  app = express();
  app.use(express.json());
  app.use("/api/aev", aevRouter);
});

afterEach(() => {
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
  rmSync(dataDir, { recursive: true, force: true });
});

const DEVICE = "test-device-000001";

async function mint(amount: number) {
  return request(app).post(`/api/aev/wallet/${DEVICE}/mint`).send({ amount });
}

describe("AEV: параллельные операции с кошельком", () => {
  test("одновременные списания не уводят баланс ниже нуля", async () => {
    await mint(100);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post(`/api/aev/wallet/${DEVICE}/spend`).send({ amount: 100, reason: "race" }),
      ),
    );

    const passed = attempts.filter((r) => r.status === 200);
    const denied = attempts.filter((r) => r.status === 409);
    expect(passed).toHaveLength(1);
    expect(denied).toHaveLength(9);

    const wallet = (await request(app).get(`/api/aev/wallet/${DEVICE}`)).body.wallet;
    expect(wallet.balance).toBe(0);
    expect(wallet.lifetimeSpent).toBe(100);
  });

  test("реестр сохраняет каждую операцию, а не последнюю", async () => {
    // Дозапись в реестр — тоже read-modify-write: без замка из двадцати
    // начислений в файле оставалось одно, и аудит расходился с балансом.
    const N = 20;
    await Promise.all(Array.from({ length: N }, () => mint(5)));

    const wallet = (await request(app).get(`/api/aev/wallet/${DEVICE}`)).body.wallet;
    expect(wallet.balance).toBe(N * 5);
    expect(wallet.lifetimeMined).toBe(N * 5);

    const ledger = (await request(app).get(`/api/aev/ledger/${DEVICE}?limit=1000`)).body;
    const entries: Array<{ kind: string; amount: number }> = ledger.entries ?? ledger.items ?? [];
    const mints = entries.filter((e) => e.kind === "mint");
    expect(mints).toHaveLength(N);
    // Реестр и баланс должны сходиться — иначе аудит бесполезен.
    expect(mints.reduce((s, e) => s + e.amount, 0)).toBe(wallet.lifetimeMined);
  });

  test("одновременные начисления и списания сходятся по балансу", async () => {
    await mint(100);

    await Promise.all([
      ...Array.from({ length: 10 }, () => mint(10)),
      ...Array.from({ length: 10 }, () =>
        request(app).post(`/api/aev/wallet/${DEVICE}/spend`).send({ amount: 10 }),
      ),
    ]);

    const wallet = (await request(app).get(`/api/aev/wallet/${DEVICE}`)).body.wallet;
    // Начислено 100 + 10×10 = 200, списано не больше 10×10 = 100.
    expect(wallet.lifetimeMined).toBe(200);
    expect(wallet.balance).toBe(wallet.lifetimeMined - wallet.lifetimeSpent);
    expect(wallet.balance).toBeGreaterThanOrEqual(0);
  });
});
