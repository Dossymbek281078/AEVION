import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/*
 * 🔴 Дневная норма ИИ-тренера — СПЯЩИЙ механизм.
 *
 * Решение оркестратора 13.10.2026: FREE_COACH_PER_DAY не задана — ручки ведут
 * себя как прежде; задана — сверх нормы 402 с upgradeUrl на тариф CyberChess.
 * Сторож делает настоящие POST к /api/coach/chat (поставщик подменён, чтобы
 * не платить), а не зовёт функцию нормы напрямую.
 */
vi.mock("../src/services/qcoreai/providers", async () => {
  const реальный = await vi.importActual<typeof import("../src/services/qcoreai/providers")>(
    "../src/services/qcoreai/providers",
  );
  const поставщики = [
    { id: "gemini", configured: true, defaultModel: "gemini-2.5-flash" },
    { id: "stub", configured: true, defaultModel: "stub" },
  ];
  return {
    ...реальный,
    getProviders: () => поставщики as any,
    isProviderOutOfService: () => false,
    listProviderOutages: () => [],
    noteProviderOutage: () => {},
    resolveProvider: () => "gemini",
    callProvider: vi.fn(async (id: string) => ({ reply: "Конь на f3 держит центр.", model: "gemini-2.5-flash", usage: null, providerUsed: id })),
  };
});

const тело = { system: "Ты шахматный тренер.", messages: [{ role: "user", content: "Какой ход лучше?" }], maxTokens: 100 };

async function приложение(auth?: { sub: string }, сброс = true) {
  const { coachRouter } = await import("../src/routes/coach");
  const { sbrositNormu } = await import("../src/lib/coachNorma");
  // Счёт живёт в процессе, не в приложении: сброс — это «новый день», и его
  // нельзя делать молча при каждой сборке, иначе сценарий «вошедший после гостей
  // с того же IP» ничего не проверяет (мутация «вошедший = гость» выживала).
  if (сброс) sbrositNormu();
  const a = express();
  a.use(express.json());
  if (auth) a.use((req, _res, next) => { (req as any).auth = auth; next(); });
  a.use("/api/coach", coachRouter);
  return a;
}

const былаПеременная = process.env.FREE_COACH_PER_DAY;
beforeEach(() => { delete process.env.FREE_COACH_PER_DAY; });
afterEach(() => { if (былаПеременная === undefined) delete process.env.FREE_COACH_PER_DAY; else process.env.FREE_COACH_PER_DAY = былаПеременная; });

describe("норма тренера спит, пока переменная не задана", () => {
  it("🔴 не задана — три запроса подряд отвечают 200, 402 нет", async () => {
    const a = await приложение();
    for (let i = 0; i < 3; i++) {
      const r = await request(a).post("/api/coach/chat").send(тело);
      expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    }
  });

  it("пустая строка и мусор в переменной — тоже сон, а не норма 0", async () => {
    process.env.FREE_COACH_PER_DAY = "   ";
    let r = await request(await приложение()).post("/api/coach/chat").send(тело);
    expect(r.status).toBe(200);
    process.env.FREE_COACH_PER_DAY = "много";
    r = await request(await приложение()).post("/api/coach/chat").send(тело);
    expect(r.status).toBe(200);
  });
});

describe("норма тренера проснулась", () => {
  it("🔴 FREE_COACH_PER_DAY=2: два ответа, третий — 402 с адресом тарифа", async () => {
    process.env.FREE_COACH_PER_DAY = "2";
    const a = await приложение();
    expect((await request(a).post("/api/coach/chat").send(тело)).status).toBe(200);
    expect((await request(a).post("/api/coach/chat").send(тело)).status).toBe(200);
    const r = await request(a).post("/api/coach/chat").send(тело);
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("coach_quota_exhausted");
    expect(r.body.upgradeUrl).toBe("/pricing?app=cyberchess");
    expect(r.body.limit).toBe(2);
    expect(r.body.used).toBe(2);
  });

  it("🔴 у другого гостя (другое устройство) своя норма; у вошедшего — по его sub", async () => {
    process.env.FREE_COACH_PER_DAY = "1";
    const a = await приложение();
    expect((await request(a).post("/api/coach/chat").set("x-aevion-device", "dev-A").send(тело)).status).toBe(200);
    expect((await request(a).post("/api/coach/chat").set("x-aevion-device", "dev-A").send(тело)).status).toBe(402);
    // тот же IP (supertest), но другое устройство — ключ по IP уже израсходован: это ЗАМЫСЕЛ
    // (гость считается и по IP, и по устройству, как у Мультичата), поэтому здесь ждём 402
    expect((await request(a).post("/api/coach/chat").set("x-aevion-device", "dev-B").send(тело)).status).toBe(402);
    // вошедший — отдельный ключ по sub, IP не мешает: счёт НЕ сбрасываем, IP-ключ уже исчерпан
    const b = await приложение({ sub: "user-1" }, false);
    expect((await request(b).post("/api/coach/chat").send(тело)).status).toBe(200);
    expect((await request(b).post("/api/coach/chat").send(тело)).status).toBe(402);
  });

  it("поток /chat/stream под той же нормой", async () => {
    process.env.FREE_COACH_PER_DAY = "0";
    const r = await request(await приложение()).post("/api/coach/chat/stream").send(тело);
    expect(r.status).toBe(402);
    expect(r.body.upgradeUrl).toBe("/pricing?app=cyberchess");
  });

  it("день считается по Алматы, а не по UTC", async () => {
    const { denAlmaty } = await import("../src/lib/coachNorma");
    // 2026-10-12T22:30Z = 13.10 03:30 по Алматы
    expect(denAlmaty(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
    expect(denAlmaty(new Date("2026-10-12T18:30:00Z"))).toBe("2026-10-12");
  });
});
