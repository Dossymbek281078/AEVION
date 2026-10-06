import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож РУЧКИ, а не признака.
 *
 * Первая версия этой проверки трогала только `похожеНаПробу` — и мутация
 * «пробы снова в счёте» прошла насквозь: тест охранял не то, что обещал.
 * Правило §0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС: проверка на ручку обязана делать запрос к
 * ручке и смотреть ТЕЛО ответа.
 *
 * Повод: 06.10.2026 после проверки живости Brevo на проде осталась строка
 * `yahiin1978+probe-brevo@gmail.com` / `probe-brevo-0610`, и она считалась
 * человеком в листе ожидания — цифре, по которой судят о спросе.
 */

process.env.AUTH_JWT_SECRET = "waitlist-guard-secret-at-least-32-chars-000";
process.env.NODE_ENV = "test";

const СТРОКИ = [
  { email: "human1@gmail.com", source: "landing", createdAt: "2026-10-01T10:00:00.000Z", channel: null },
  { email: "yahiin1978+probe-brevo@gmail.com", source: "probe-brevo-0610", createdAt: "2026-10-06T09:04:49.000Z", channel: null },
  { email: "human2@mail.ru", source: "ig", createdAt: "2026-10-02T10:00:00.000Z", channel: null },
  { email: "smoke-c2@aevion.app", source: "landing", createdAt: "2026-10-03T10:00:00.000Z", channel: null },
];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (/CREATE TABLE|CREATE INDEX|ALTER TABLE/i.test(sql)) return { rows: [] };
      return { rows: СТРОКИ };
    },
  }),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { constitutionWaitlistAdminRouter } = await import("../src/routes/constitutionWaitlist");
const jwt = (await import("jsonwebtoken")).default;

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/admin/constitution/waitlist", constitutionWaitlistAdminRouter);
  return a;
}

const админ = () =>
  jwt.sign({ email: "yahiin1978@gmail.com", sub: "admin", role: "admin" }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

async function список(хвост = "") {
  return request(приложение())
    .get(`/api/admin/constitution/waitlist/list${хвост}`)
    .set("Authorization", `Bearer ${админ()}`);
}

describe("лист ожидания: ручка не считает наши пробы людьми", () => {
  beforeEach(() => vi.clearAllMocks());

  test("total считает только живых, а скрытое названо числом", async () => {
    const r = await список();
    expect(r.status).toBe(200);
    expect(r.body.total, "наши пробы попали в счёт листа ожидания").toBe(2);
    expect(r.body.ourProbesHidden, "скрытое обязано называться числом").toBe(2);
    expect(r.body.total + r.body.ourProbesHidden).toBe(СТРОКИ.length);
  });

  test("в выдаче нет ни одного пробного адреса", async () => {
    const r = await список();
    const адреса = (r.body.items as Array<{ email: string }>).map((x) => x.email);
    expect(адреса).toContain("human1@gmail.com");
    expect(адреса).not.toContain("yahiin1978+probe-brevo@gmail.com");
    expect(адреса).not.toContain("smoke-c2@aevion.app");
  });

  test("разрез по источникам тоже без проб", async () => {
    const r = await список();
    const метки = (r.body.bySource as Array<{ source: string }>).map((x) => x.source);
    expect(метки, "метка пробы осталась в разрезе по источникам").not.toContain("probe-brevo-0610");
    expect(метки).toContain("landing");
  });

  test("?includeProbes=1 возвращает всё — для наших проверок", async () => {
    const r = await список("?includeProbes=1");
    expect(r.body.total).toBe(СТРОКИ.length);
    expect(r.body.ourProbesHidden).toBe(0);
  });

  test("контроль: без входа ручка не отдаёт ничего", async () => {
    // Иначе зелёный выше не значил бы ничего: может, мы читаем чужой ответ.
    const r = await request(приложение()).get("/api/admin/constitution/waitlist/list");
    expect(r.status).toBe(403);
  });
});
