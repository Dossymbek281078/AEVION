import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/*
 * 🔴 Стена модуля ведёт на КАРТОЧКУ модуля на /pricing, а не на общую страницу.
 *
 * Замер 13.10.2026 (гость Мультичата, 390×844): после бесплатного ответа стена
 * предлагала «Перейти к тарифам» → https://aevion.app/pricing — тридцать карточек,
 * Multichat ($40) надо искать; у самой страницы модуля кнопка «Купить» ведёт на
 * /pricing?app=multichat#apps. Slug — из MODULES_PRICING (источник истины витрины).
 * Сторож: чистая функция + настоящий 402 через requireModule.
 */
process.env.PAYWALL_MODULES = "multichat-engine";
delete process.env.PAYWALL_DISABLED;

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn(async () => ({ rows: [] })) }) }));

describe("стена ведёт на карточку модуля", () => {
  it("🔴 slug из витрины: multichat-engine → /pricing?app=multichat#apps; модуль без карточки → /pricing", async () => {
    const { ссылкаНаТариф } = await import("../src/lib/planGate");
    expect(ссылкаНаТариф("multichat-engine")).toBe("/pricing?app=multichat#apps");
    expect(ссылкаНаТариф("aevion-ip-bureau")).toBe("/pricing?app=ip_bureau#apps");
    expect(ссылкаНаТариф("такого-модуля-нет")).toBe("/pricing");
  });

  it("🔴 настоящий 402 гостю: upgradeUrl и текст указывают на карточку Multichat", async () => {
    const { requireModule } = await import("../src/lib/planGate");
    const a = express();
    a.use(express.json());
    const r = express.Router();
    r.post("/conversations", (_req, res) => { res.json({ ok: true }); });
    a.use("/api/multichat", requireModule("multichat-engine"), r);
    const res = await request(a).post("/api/multichat/conversations").send({ title: "проба" });
    expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(402);
    expect(res.body.error).toBe("upgrade_required");
    expect(String(res.body.upgradeUrl)).toMatch(/\/pricing\?app=multichat#apps$/);
    expect(String(res.body.message)).toContain("/pricing?app=multichat#apps");
    // контроль: ссылка входа осталась прежней
    expect(String(res.body.loginUrl)).toContain("/auth?next=");
  });
});
