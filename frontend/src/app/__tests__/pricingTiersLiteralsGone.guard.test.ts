import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PRICING_TERMS } from "@/lib/products";

/**
 * 20.10.2026, окно «Приложения», задача 3 по слову оркестратора.
 *
 * Ссылка на покупку подписки — одна константа PRICING_TERMS (сейчас /pricing#planet-buy —
 * кнопка оплаты Планеты). До этого шесть мест держали литерал "/pricing#tiers": окно квоты
 * QRight, каталог /apps, конституция (две), мастер биржи стартапов, запасной адрес Gumroad —
 * и когда якорь сменился, они продолжали вести на верх блока, который не крутил, пока
 * тарифы грузятся. Исключение — /go: своя строка под отдельным сторожем, по слову оркестратора.
 */
const SRC = join(__dirname, "..", "..");
const EXCEPT = new Set(["app/go/page.tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("покупка подписки — через PRICING_TERMS, не литералом", () => {
  test("константа ведёт к кнопке оплаты Планеты", () => {
    expect(PRICING_TERMS).toBe("/pricing#planet-buy");
  });

  test("литерала \"/pricing#tiers\" в исходниках нет (кроме /go)", () => {
    const found: string[] = [];
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f).replace(/\\/g, "/");
      if (EXCEPT.has(rel)) continue;
      const s = readFileSync(f, "utf8");
      if (s.includes('"/pricing#tiers"') || s.includes("'/pricing#tiers'") || s.includes("`/pricing#tiers`")) found.push(rel);
    }
    expect(found).toEqual([]);
  });

  test("шесть прежних мест берут константу", () => {
    for (const rel of ["app/qright/page.tsx", "app/apps/page.tsx", "app/constitution/page.tsx", "app/constitution/pricing/page.tsx", "app/startup-exchange/components/ListingWizard.tsx", "lib/gumroad.ts"]) {
      const s = readFileSync(join(SRC, rel), "utf8");
      expect(s, rel).toContain("PRICING_TERMS");
    }
  });
});
