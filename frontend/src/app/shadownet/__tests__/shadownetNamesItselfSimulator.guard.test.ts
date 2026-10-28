/**
 * ShadowNet называет себя симулятором на всех поверхностях.
 * 20.10.2026 (слово Оркестратора): кнопка «ShadowNet Pro — максимальная приватность», title/og
 * «Alternative Private Network», description «mesh-обмен, off-grid» — при подписи «СИМУЛЯТОР»
 * на странице. Настоящее — шифрование заметок в браузере (AES-GCM 256).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const D = join(__dirname, "..");
const безКомментариев = (s: string) => s.replace(/^\s*\/\/.*$/gm, "");
const поверхности = ["page.tsx", "layout.tsx", "opengraph-image.tsx"].map(
  (f) => [f, безКомментариев(readFileSync(join(D, f), "utf8"))] as const,
);
const реестр = безКомментариев(
  readFileSync(join(D, "..", "..", "..", "..", "aevion-globus-backend", "src", "data", "projects.ts"), "utf8"),
);

describe("ShadowNet: без обещаний сети и «максимальной приватности»", () => {
  for (const [f, src] of поверхности) {
    it(f, () => {
      expect(src).not.toMatch(/максимальная приватность|maximum privacy|Alternative Private Network|mesh-обмен|off-grid|mesh fallback/i);
    });
  }
  // 28.10.2026 (Приложения-2): «ShadowNet Pro» снят — такого Pro в продаже нет, кнопка ведёт на подписку Планеты
  // (сторож app/__tests__/knopkaOplatyNeObeshchaetPro). Кнопка теперь с подписью по умолчанию.
  it("кнопка без несуществующего Pro, title называет симулятор", () => {
    expect(поверхности[0][1]).toContain('<PaddleUpgradeButton variant="banner" appId="shadownet" />');
    expect(поверхности[0][1]).not.toMatch(/ShadowNet Pro/);
    expect(поверхности[1][1]).toContain("ShadowNet — симулятор приватной сети");
  });
  it("реестр модулей (/api/pricing, /api/globus/projects) — тоже симулятор", () => {
    const i = реестр.indexOf('id: "shadownet"');
    expect(i).toBeGreaterThan(0);
    expect(реестр.slice(i, i + 300)).toContain('name: "ShadowNet — симулятор приватной сети"');
  });
});
