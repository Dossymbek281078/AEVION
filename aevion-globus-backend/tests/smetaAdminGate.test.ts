import { describe, expect, it, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * Пять ручек /admin тренажёра отдавали список учеников и их успеваемость
 * без единой проверки — 28.08.2026 закрыто предикатом isSmetaAdmin.
 *
 * ПОЧЕМУ СТОРОЖ ПОЯВИЛСЯ ОТДЕЛЬНО. Первая версия починки имела отдушину
 * «при NODE_ENV=test пропускать любой Bearer»: она была нужна, чтобы не
 * ломать существующие прогоны LMS. Цена оказалась выше пользы — под ней
 * настоящая логика ролей не исполнялась в тестах ВООБЩЕ, то есть защиту
 * нельзя было ни проверить, ни удержать от отката. Отдушина сделана явной
 * (SMETA_ADMIN_TEST_BYPASS=1), и этот файл проверяет настоящую логику.
 *
 * Проверяем ОБЕ двери, которыми даётся право: роль admin в токене и почта в
 * списке SMETA_ADMIN_EMAILS. Вторая существует потому, что у куратора роли
 * может не быть, и без неё починка закрыла бы доступ тем, кому он нужен.
 */

const SECRET = "test-secret-smeta-admin-gate";
let app: express.Express;

beforeAll(async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.SMETA_ADMIN_TEST_BYPASS;
  const { smetaTrainerRouter } = await import("../src/routes/smeta-trainer");
  app = express();
  app.use(express.json());
  app.use(smetaTrainerRouter);
});

afterEach(() => {
  delete process.env.SMETA_ADMIN_TEST_BYPASS;
  delete process.env.SMETA_ADMIN_EMAILS;
});

const sign = (payload: object) =>
  jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: "1h" });

const ADMIN_ROUTES = [
  { method: "get" as const, path: "/admin/students" },
  { method: "get" as const, path: "/admin/webhooks" },
];

describe("Тренажёр: ручки /admin закрыты", () => {
  for (const r of ADMIN_ROUTES) {
    it(`${r.path} без токена не отдаёт данные`, async () => {
      const res = await request(app)[r.method](r.path);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("admin_required");
    });

    it(`${r.path} с токеном обычного пользователя не отдаёт данные`, async () => {
      const res = await request(app)[r.method](r.path)
        .set("Authorization", `Bearer ${sign({ email: "student@example.com" })}`);
      expect(res.status).toBe(403);
    });
  }

  it("подделанный токен не пускает", async () => {
    const forged = jwt.sign({ email: "x@y.z", role: "admin" }, "другой-секрет", {
      algorithm: "HS256",
    });
    const res = await request(app).get("/admin/students").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("bad-token");
  });

  it("роль admin в токене пускает", async () => {
    const res = await request(app).get("/admin/students")
      .set("Authorization", `Bearer ${sign({ email: "a@b.c", role: "admin" })}`);
    expect(res.status).not.toBe(403);
  });

  it("почта из SMETA_ADMIN_EMAILS пускает без роли", async () => {
    process.env.SMETA_ADMIN_EMAILS = "curator@aevion.app, second@aevion.app";
    const res = await request(app).get("/admin/students")
      .set("Authorization", `Bearer ${sign({ email: "Curator@AEVION.app" })}`);
    expect(res.status).not.toBe(403);
  });

  it("контроль прибора: явная отдушина для прогонов работает", async () => {
    process.env.SMETA_ADMIN_TEST_BYPASS = "1";
    const res = await request(app).get("/admin/students")
      .set("Authorization", "Bearer any-token-shape");
    expect(res.status).not.toBe(403);
  });
});
