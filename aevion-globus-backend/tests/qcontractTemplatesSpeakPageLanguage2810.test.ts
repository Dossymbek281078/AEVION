// Шаблоны QContract на языке страницы (28.10.2026).
//
// Замер на проде: /api/qcontract/templates отдавал пять договоров только по-русски,
// и /qcontract/create?lang=en|kk вставлял в форму русский NDA. Тест спрашивает
// саму ручку: список и полный шаблон на en/kk без кириллицы-русского, ru — исходник,
// незнакомый язык — исходник, а не 500 и не пустота.

import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rows: [] }) }),
}));

async function app() {
  const { qcontractRouter } = await import("../src/routes/qcontract");
  const a = express();
  a.use("/api/qcontract", qcontractRouter);
  return a;
}

const РУССКИЕ = /[ЁёЫыЭэЪъ]|[А-Яа-я]{3,}/;
const КАЗАХСКИЕ = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;

describe("шаблоны договоров на языке страницы", () => {
  test("контроль: ru и без lang — русский исходник, пять шаблонов", async () => {
    const a = await app();
    for (const q of ["", "?lang=ru"]) {
      const r = await request(a).get(`/api/qcontract/templates${q}`);
      expect(r.status).toBe(200);
      expect(r.body.templates).toHaveLength(5);
      expect(r.body.templates[0].title).toMatch(/Соглашение о неразглашении/);
    }
  });

  test("en: список и каждый полный шаблон без русского", async () => {
    const a = await app();
    const r = await request(a).get("/api/qcontract/templates?lang=en");
    expect(r.body.templates).toHaveLength(5);
    for (const t of r.body.templates) {
      expect(`${t.title} ${t.description}`, t.id).not.toMatch(РУССКИЕ);
      const full = await request(a).get(`/api/qcontract/templates/${t.id}?lang=en`);
      expect(full.status).toBe(200);
      expect(full.body.content.length, t.id).toBeGreaterThan(200);
      expect(full.body.content, t.id).not.toMatch(/[А-Яа-яЁё]{3,}/);
    }
  });

  test("kk: каждый шаблон по-казахски, не совпадает с русским", async () => {
    const a = await app();
    const ru = (await request(a).get("/api/qcontract/templates")).body.templates;
    const kk = (await request(a).get("/api/qcontract/templates?lang=kk")).body.templates;
    expect(kk).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(kk[i].id).toBe(ru[i].id);
      expect(kk[i].title, kk[i].id).not.toBe(ru[i].title);
      const full = (await request(a).get(`/api/qcontract/templates/${kk[i].id}?lang=kk`)).body;
      const ruFull = (await request(a).get(`/api/qcontract/templates/${kk[i].id}`)).body;
      expect(full.content, kk[i].id).toMatch(КАЗАХСКИЕ);
      expect(full.content).not.toBe(ruFull.content);
      // пропуски для заполнения не потеряны при переводе
      const пропуски = (s: string) => (s.match(/_{5,}/g) || []).length;
      expect(пропуски(full.content), kk[i].id).toBe(пропуски(ruFull.content));
    }
  });

  test("незнакомый язык и неизвестный шаблон: исходник и 404, не 500", async () => {
    const a = await app();
    const r = await request(a).get("/api/qcontract/templates/nda?lang=fr");
    expect(r.status).toBe(200);
    expect(r.body.title).toMatch(/Соглашение/);
    expect((await request(a).get("/api/qcontract/templates/net?lang=en")).status).toBe(404);
  });
});
