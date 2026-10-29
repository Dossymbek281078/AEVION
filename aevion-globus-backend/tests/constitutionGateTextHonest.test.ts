// Стена constitution не называет снятый тариф и говорит по-человечески.
// 27.10.2026 (Приложения-2): requirePro отвечал «Функция доступна в Constitution Pro ($9/мес)» — тарифы
// Конституции сняты 15.09 (pricing.ts), Pro даёт подписка AEVION; aiRateGate — «Free tier… Upgrade → Pro».
import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { requirePro } from "../src/lib/constitutionGate";

function ответ() {
  const r = { code: 0, body: null as unknown as Record<string, unknown> };
  const res = {
    status(c: number) { r.code = c; return res; },
    json(b: Record<string, unknown>) { r.body = b; return res; },
  } as unknown as Response;
  return { r, res };
}

describe("constitutionGate: текст стены", () => {
  it("гость без токена получает 402 без снятой цены $9 и без «Upgrade»", () => {
    const { r, res } = ответ();
    const next = vi.fn();
    requirePro({ headers: {} } as unknown as Request, res, next);
    expect(next, "контроль: гость не должен пройти").not.toHaveBeenCalled();
    expect(r.code).toBe(402);
    const msg = String(r.body.message);
    expect(msg).not.toMatch(/\$\s?9\b|9\/мес|Upgrade|Constitution Pro/);
    expect(msg).toContain("подпиской AEVION");
    expect(r.body.upgradeUrl).toMatch(/\/constitution\/pricing$/);
  });

  it("текст суточной нормы ИИ в исходнике — без «Free tier» и «Upgrade → Pro»", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "lib", "constitutionGate.ts"), "utf8");
    const i = src.indexOf('error: "ai_daily_limit"');
    expect(i, "контроль разбора: ответ нормы найден").toBeGreaterThan(0);
    const блок = src.slice(i, src.indexOf("});", i));
    expect(блок).not.toMatch(/Free tier|Upgrade/);
    expect(блок).toContain("${used} из ${limit}");
  });

  it("предел публикаций (402 free_save_limit) — без «Free-тариф» и «Upgrade → Pro»", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "routes", "planetConstitution.ts"), "utf8");
    const i = src.indexOf('error: "free_save_limit"');
    expect(i, "контроль разбора: ответ предела найден").toBeGreaterThan(0);
    const блок = src.slice(i, src.indexOf("});", i));
    expect(блок).toContain("message:");
    expect(блок).not.toMatch(/Free-тариф|Upgrade/);
    expect(блок).toContain("подпиской AEVION");
  });
});
