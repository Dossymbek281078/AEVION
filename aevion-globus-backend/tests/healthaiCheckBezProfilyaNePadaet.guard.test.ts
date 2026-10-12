import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * 🔴 ПРОВЕРКА СИМПТОМОВ БЕЗ ПРОФИЛЯ НЕ ПАДАЕТ В 500.
 *
 * Sentry AEVION-BACKEND-1G, 12.10.2026 22:20: POST /api/healthai/check падал
 * на внешнем ключе fk_sc_profile. guardProfile пускает несуществующий
 * profileId намеренно (бесплатная проверка гостю), а addCheck вставлял строку
 * в "SymptomCheck", у которой profileId — внешний ключ: база отказывала, ручка
 * отвечала 500, бесплатная попытка к этому моменту была уже списана.
 *
 * Сторож делает настоящий запрос к роутеру; база — заглушка, которая на
 * INSERT в SymptomCheck БРОСАЕТ ошибку внешнего ключа, как прод. Так доказано,
 * что при отсутствии профиля вставка не вызывается вовсе.
 */
const состояние = { профильЕсть: false, вставок: 0 };
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (/FROM "HealthProfile"/.test(sql)) {
        return состояние.профильЕсть
          ? { rows: [{ id: "hp-1", age: 30, sex: "other", heightCm: 170, weightKg: 70, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO "SymptomCheck"/.test(sql)) {
        состояние.вставок += 1;
        if (!состояние.профильЕсть) {
          const e = new Error('insert or update on table "SymptomCheck" violates foreign key constraint "fk_sc_profile"');
          (e as Error & { code: string }).code = "23503";
          throw e;
        }
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
}));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));

async function приложение() {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://zaglushka";
  delete process.env.PAID_ACTIONS;
  const { healthaiRouter } = await import("../src/routes/healthai");
  const app = express();
  app.use(express.json());
  app.use(healthaiRouter);
  return app;
}

beforeEach(() => { состояние.профильЕсть = false; состояние.вставок = 0; });

describe("POST /check без профиля", () => {
  test("🔴 профиля нет — ответ есть, сохранения нет, 500 нет", async () => {
    const r = await request(await приложение()).post("/check").send({ profileId: "hp-net", symptoms: ["головная боль"] });
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    expect(r.body.check, "совета нет").toBeTruthy();
    expect(r.body.saved, "о несохранении надо сказать прямо").toBe(false);
    expect(r.body.reason).toBe("profile-not-found");
    expect(состояние.вставок, "вставка в SymptomCheck всё же вызвана").toBe(0);
  });

  test("контроль: профиль есть — сохраняется как раньше", async () => {
    состояние.профильЕсть = true;
    const r = await request(await приложение()).post("/check").send({ profileId: "hp-1", symptoms: ["головная боль"] });
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    expect(r.body.saved).toBe(true);
    expect(состояние.вставок).toBe(1);
  });

  test("контроль прибора: заглушка базы действительно бросает на вставке без профиля", async () => {
    const { getPool } = await import("../src/lib/dbPool");
    await expect(getPool().query('INSERT INTO "SymptomCheck" (x) VALUES (1)')).rejects.toThrow(/fk_sc_profile/);
  });
});
