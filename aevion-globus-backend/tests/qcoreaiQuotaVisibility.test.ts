import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Health QCoreAI обязан показывать, применяется ли учёт токенов НА САМОМ ДЕЛЕ.
 *
 * Зачем. Тарифы на витрине обещают лимиты («Medium — 10 000 000 токенов в
 * месяц»), но проверка платных тарифов в `qcoreQuota` спит, пока не поднят флаг
 * `QCOREAI_TIER_QUOTA`, а бесплатная — пока не поднят `QCOREAI_FREE_QUOTA`.
 * До 28.07 состояние этих флагов не было видно снаружи: сверить обещание с
 * фактом мог только тот, у кого есть доступ к переменным окружения. Весь аудит
 * заявлений этого дня строился на правиле «на витрине пишем то, что отвечает
 * health» — но для этого health должен отвечать.
 *
 * Проверяем не наличие поля, а его СВЯЗЬ с окружением: поле-константа было бы
 * ровно тем же дефектом, что уже находился в `/api/modules/:id/health`, где
 * `ok: true` возвращалось всегда.
 */

// Импорт роутера тянет провайдеров и таблицы — под полным параллельным
// прогоном это выходит за дефолтные 5с. Тот же случай, что с jsdom-тестами:
// падение выглядит как дефект, а является таймаутом.
vi.setConfig({ testTimeout: 30_000 });

const ENV_KEYS = ["QCOREAI_FREE_QUOTA", "QCOREAI_TIER_QUOTA"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function health() {
  // Импортируем роутер ПОСЛЕ установки env: значения читаются в обработчике,
  // но модуль тянет за собой провайдеров, и порядок стоит зафиксировать.
  const { qcoreaiRouter } = await import("../src/routes/qcoreai");
  const app = express();
  app.use(express.json());
  app.use("/api/qcoreai", qcoreaiRouter);
  return request(app).get("/api/qcoreai/health");
}

describe("health QCoreAI показывает, применяется ли учёт токенов", () => {
  test("оба флага подняты → оба признака true", async () => {
    process.env.QCOREAI_FREE_QUOTA = "1";
    process.env.QCOREAI_TIER_QUOTA = "1";
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.quotaEnforcement).toEqual({ free: true, paidTiers: true });
  });

  test("флаги сняты → оба признака false, а не отсутствуют", async () => {
    delete process.env.QCOREAI_FREE_QUOTA;
    delete process.env.QCOREAI_TIER_QUOTA;
    const res = await health();
    // Именно false, а не undefined: отсутствие поля читалось бы как «не знаем»,
    // тогда как мы знаем — учёт выключен.
    expect(res.body.quotaEnforcement).toEqual({ free: false, paidTiers: false });
  });

  test("флаги независимы — признак не общий на двоих", async () => {
    process.env.QCOREAI_FREE_QUOTA = "1";
    delete process.env.QCOREAI_TIER_QUOTA;
    const res = await health();
    expect(res.body.quotaEnforcement).toEqual({ free: true, paidTiers: false });
  });

  test("любое значение кроме «1» не считается включением", async () => {
    // Иначе `QCOREAI_TIER_QUOTA=0` или `=false` читались бы как «включено» —
    // ровно та ошибка, из-за которой флаги и становятся ненадёжными.
    process.env.QCOREAI_TIER_QUOTA = "0";
    process.env.QCOREAI_FREE_QUOTA = "true";
    const res = await health();
    expect(res.body.quotaEnforcement).toEqual({ free: false, paidTiers: false });
  });
});
