/**
 * Биржа стартапов: сохранённый (русский) разбор при lang=en отдаётся английским в GET /ideas/:id и /ideas.
 * Баллы те же, в базу ничего не пишется; без lang и при lang=ru ответ прежний.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import { startupExchangeRouter } from "../src/routes/startupExchange";
import { OFFICIAL_TRANSLATIONS, withOfficialTranslation } from "../src/lib/startupx/officialTranslations";

const CYR = /[Ѐ-ӿ]/;
const DESC =
  "Проблема: мелкие перевозчики в Казахстане ищут грузы вручную, через чаты, и теряют до трети рейсов на пустом пробеге. " +
  "Для кого: перевозчики с парком 1–5 машин. Мы делаем платформу, которая автоматически подбирает обратный груз по маршруту. " +
  "Зарабатываем на комиссии 5% с каждой сделки. В отличие от досок объявлений, подбор идёт по факту освободившейся машины.";

let server: http.Server;
let base = "";
let ids: number[] = [];

async function call(path: string, init?: RequestInit) {
  const r = await fetch(base + path, init);
  return { status: r.status, text: await r.text() };
}

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/startupx", startupExchangeRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/startupx`;
  for (let i = 0; i < 2; i++) {
    const r = await call("/ideas", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${i + 1}` },
      body: JSON.stringify({
        title: `Логистика для перевозчиков ${i}`,
        description: DESC,
        tier: "idea",
        sector: "marketplace",
        geography: "Казахстан, Астана",
        founderEmail: "founder@example.com",
        contactMethod: "telegram: @founder",
        deal: { intent: "raise", askUsd: 30_000, equityOfferedPct: 15, buildBy: "founder" },
      }),
    });
    const j = JSON.parse(r.text);
    if (!j.success) throw new Error(r.text);
    ids.push((j.data?.listing ?? j.data).id);
  }
}, 30_000);

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("сохранённый разбор по языку", () => {
  it("GET /ideas/:id?lang=en: разбор без кириллицы, балл тот же", async () => {
    const ru = JSON.parse((await call(`/ideas/${ids[0]}`)).text).data;
    const en = JSON.parse((await call(`/ideas/${ids[0]}?lang=en`)).text).data;
    expect(ru.assessment.score).toBeGreaterThan(0);
    expect(en.assessment.score).toBe(ru.assessment.score);
    expect(en.assessment_score).toBe(ru.assessment_score);
    expect(en.assessment.version).toBe(ru.assessment.version);
    expect(strings(en.assessment).some((s) => CYR.test(s))).toBe(false);
    expect(strings(ru.assessment).some((s) => CYR.test(s))).toBe(true);
  });

  it("GET /ideas?lang=en: то же для ленты", async () => {
    const ru = JSON.parse((await call(`/ideas`)).text).data.listings.find((l: { id: number }) => l.id === ids[1]);
    const en = JSON.parse((await call(`/ideas?lang=en`)).text).data.listings.find((l: { id: number }) => l.id === ids[1]);
    expect(en.assessment.score).toBe(ru.assessment.score);
    expect(strings(en.assessment).some((s) => CYR.test(s))).toBe(false);
  });

  it("без lang и при lang=ru: ответ прежний, байт в байт", async () => {
    const a = (await call(`/ideas/${ids[0]}`)).text;
    const b = (await call(`/ideas/${ids[0]}?lang=ru`)).text;
    const c = (await call(`/ideas/${ids[0]}?lang=de`)).text;
    const norm = (t: string) => t.replace(/"views":\d+/, "");
    expect(norm(b)).toBe(norm(a));
    expect(norm(c)).toBe(norm(a));
    expect(CYR.test(JSON.parse(a).data.assessment.headline)).toBe(true);
  });
});

describe("заявка 21: geography и ru-поправка", () => {
  const ROW = { id: 21, title: "T", description: "Раз. 20 сентября 2026 открываются восемь модулей разом. Два.", geography: "Казахстан, Астана" };

  it("en: geography английская, в описании открылись", () => {
    const v = withOfficialTranslation(ROW, "en");
    expect(v.geography).toBe("Kazakhstan, Astana");
    expect(OFFICIAL_TRANSLATIONS[21].en.description).toContain("On September 20, 2026 eight modules opened at once.");
    expect(CYR.test(v.geography ?? "")).toBe(false);
  });

  it("ru и без lang: «открылись», остальное слово в слово", () => {
    for (const lang of ["ru", ""]) {
      const v = withOfficialTranslation(ROW, lang);
      expect(v.description).toBe("Раз. 20 сентября 2026 открылись восемь модулей разом. Два.");
      expect(v.title).toBe(ROW.title);
      expect(v.geography).toBe(ROW.geography);
      expect((v as { translated?: boolean }).translated).toBeUndefined();
    }
  });

  it("у других id ответ тот же объект", () => {
    const other = { id: 22, title: "x", description: "20 сентября 2026 открываются восемь модулей разом" };
    expect(withOfficialTranslation(other, "ru")).toBe(other);
    expect(withOfficialTranslation(other, "")).toBe(other);
    expect(withOfficialTranslation(other, "en")).toBe(other);
  });
});
