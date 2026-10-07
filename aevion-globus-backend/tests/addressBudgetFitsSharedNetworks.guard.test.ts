import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Месячная норма НА АДРЕС рассчитана на общую сеть, а не на одного человека.
 *
 * 🔴 ЗАМЕР 06.10.2026. Норма на адрес брала ТОТ ЖЕ предел, что у одного гостя
 * (TIER_LIMITS.free), и применялась к каждой возможности: 30 генераций и 10
 * выкаток в месяц НА АДРЕС. Под CGNAT мобильного оператора за одним адресом
 * тысячи абонентов — значит 31-й человек получал 402, ничего не сделав, и умирал
 * ПЕРВЫЙ шаг воронки. Поймано на себе: свежий гость получил
 * «Monthly deploy limit reached, used 10, limit 10», потому что норму адреса
 * израсходовали наши собственные замеры.
 *
 * Что предел охранял, числами: гостевая генерация идёт на Gemini Flash и стоит
 * по замерам $0.0015–$0.0023. Предел «30 на адрес» охранял около $0.06 в месяц.
 *
 * Коэффициенты назначены оркестратором по ЦЕНЕ возможности. Сторож проверяет
 * ГРАНИЦУ запросами к ручке, а не копию правила.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [
    { id: "gemini", name: "G", models: [], defaultModel: "m", envKey: "GEMINI_API_KEY", configured: true },
  ],
  callProvider: async () => ({
    reply: JSON.stringify({ files: [{ path: "index.html", content: "<h1>x</h1>", language: "html" }] }),
    model: "m",
    usage: {},
  }),
}));

// eslint-disable-next-line import/first
import {
  devhubRouter, __resetDevHubStore, __setMonthUsageForTest, пределАдреса,
} from "../src/routes/devhub";

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

async function генерация(гость: string) {
  const app = приложение();
  const cr = await request(app).post("/api/devhub/projects").set("x-devhub-guest", гость).send({ name: "P" });
  const id = cr.body.project?.id;
  return request(app)
    .post("/api/devhub/projects/" + id + "/generate")
    .set("x-devhub-guest", гость)
    .send({ prompt: "кнопка" });
}

/** Ключ нормы адреса такой же, как в коде: guest-ip:<адрес>. В supertest адрес локальный. */
const КЛЮЧИ_АДРЕСА = ["guest-ip:::ffff:127.0.0.1", "guest-ip:127.0.0.1", "guest-ip:::1"];

beforeEach(() => { __resetDevHubStore?.(); });

describe("норма на адрес рассчитана на общую сеть", () => {
  test("прибор исправен: предел адреса кратен гостевому, а не равен ему", () => {
    // 30 у гостя, 50-кратно у адреса.
    expect(пределАдреса("generate"), "норма адреса равна гостевой — сеть снова упрётся").toBe(1500);
    expect(пределАдреса("translate")).toBe(2500);
    expect(пределАдреса("image")).toBe(100);
    expect(пределАдреса("deploy")).toBe(100);
    expect(пределАдреса("video")).toBe(9);
    expect(пределАдреса("music")).toBe(15);
    expect(пределАдреса("speech")).toBe(15);
    // Неперечисленное осталось как было — tts считается символами.
    expect(пределАдреса("tts")).toBe(10000);
  });

  test("🔴 31-я генерация с ОДНОГО адреса РАЗНЫМИ гостями проходит", async () => {
    // Ровно тот случай, что ломался: у каждого гостя своя норма (30), а адрес
    // прежде отдавал 402 на 31-й. Тридцать первым идёт НОВЫЙ гость.
    for (const ключ of КЛЮЧИ_АДРЕСА) __setMonthUsageForTest(ключ, "generate", 30);
    const r = await генерация("gost-nomer-31-" + Date.now());
    expect(r.status, `31-я генерация с адреса отбита: ${r.text.slice(0, 120)}`).not.toBe(402);
  });

  test("🔴 1501-я генерация с адреса — 402: потолок остался, просто он для СЕТИ", async () => {
    for (const ключ of КЛЮЧИ_АДРЕСА) __setMonthUsageForTest(ключ, "generate", 1500);
    const r = await генерация("gost-za-potolkom-" + Date.now());
    expect(r.status, "потолок адреса не держит — защиты расхода нет").toBe(402);
  });

  test("ОДИН гость по-прежнему ограничен СВОЕЙ нормой", async () => {
    // Контроль в обратную сторону: расширение нормы адреса не должно открывать
    // одному актору 1500 генераций.
    const гость = "gost-svoya-norma-" + Date.now();
    __setMonthUsageForTest("guest:" + гость, "generate", 30);
    const r = await генерация(гость);
    expect(r.status, "гость вышел за свою норму — щедрость адреса протекла на личность").toBe(402);
  });
});
