/*
 * 🔴 20.10.2026: на карточке плана стояли ДВА числа экономии — фронт считал
 * termSavingPercent из TERM_FACTOR (12.5/25/37.5/50), строка карточки с бэка — из
 * цен плана (10/20/30/40). Верные — из цен плана. Здесь: функция бэка, строка
 * карточки и termLadder ручки /api/pricing говорят одно число; фронт держит то же
 * сторожем termPricingMatchesBackend (текст функции) и своим тестом значений.
 */
import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "fs";
import { join } from "path";
import { pricingRouter } from "../src/routes/pricing";
import { termSavingPercent, TERM_TIERS } from "../src/data/pricing";

const app = () => { const a = express(); a.use(express.json()); a.use("/api/pricing", pricingRouter); return a; };
const ОЖИДАЕМО = { lite: 0, medium: 10, pro: 20, full: 30, max: 40 } as const;

describe("экономия срока плана — одно число на всех поверхностях", () => {
  test("termSavingPercent: 0/10/20/30/40", () => {
    for (const t of TERM_TIERS) expect(termSavingPercent(t), t).toBe(ОЖИДАЕМО[t]);
  });
  test("строка карточки /api/pricing несёт ровно termSavingPercent, без 12.5/25/37.5/50", async () => {
    const r = await request(app()).get("/api/pricing");
    expect(r.status).toBe(200);
    let проверено = 0;
    for (const t of ["medium", "pro", "full", "max"] as const) {
      const tier = (r.body.tiers as Array<{ id: string; features: string[] }>).find((x) => x.id === t)!;
      const строка = tier.features.find((f) => /^Экономия /.test(f));
      expect(строка, `${t}: строка экономии`).toBe(`Экономия ${ОЖИДАЕМО[t]}% против месяца без срока`);
      проверено++;
    }
    expect(проверено).toBe(4);
    expect(JSON.stringify(r.body.tiers)).not.toMatch(/Экономия (12\.5|25|37\.5|50)%/);
  });
  test("termLadder.factor — доля цены месяца плана 1/0.9/0.8/0.7/0.6", async () => {
    const r = await request(app()).get("/api/pricing");
    expect((r.body.termLadder as Array<{ factor: number }>).map((x) => x.factor)).toEqual([1, 0.9, 0.8, 0.7, 0.6]);
  });
  test("planetSavingPercent: строка фронта совпадает с бэкендом", () => {
    const строка = (src: string) => src.split("\n").find((l) => l.startsWith("export function planetSavingPercent(")) ?? "";
    const бэк = readFileSync(join(__dirname, "..", "src", "data", "pricing.ts"), "utf8");
    const фронт = readFileSync(join(__dirname, "..", "..", "frontend", "src", "lib", "termPricing.ts"), "utf8");
    expect(строка(бэк).length).toBeGreaterThan(40);
    expect(строка(фронт)).toBe(строка(бэк));
  });
});
