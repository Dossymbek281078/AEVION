import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { НЕ_ПРОДАЁТСЯ_ОТДЕЛЬНО } from "@/lib/neProdayotsyaOtdelno";

/**
 * 🔴 30.10.2026: слово основателя 19.10 — цены модулей ОТМЕНЕНЫ, отдельно продаются
 * только шахматы ($50/год). Но /compare писал «DevHub стоит $200 за месяц», /apps —
 * «from $32/mo» у бюро, /qcoreai/upgrade — «Multichat on its own — from $20/mo»,
 * пока гость видел план «Планета» $250…$150.
 *
 * Правило: цену «от X/мес» из базы модуля (`fromPricePerMonth`) можно печатать
 * только в файлах, которые сами отсеивают predlagaemOtdelno (список ниже), а файл,
 * берущий слаг из НЕ_ПРОДАЁТСЯ_ОТДЕЛЬНО, не смеет читать его baseMonthly/termTotal.
 */
const ROOT = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))];
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");

/** Файлы, где fromPricePerMonth печатается только для отдельно продаваемого (проверено 30.10). */
const РАЗРЕШЕНО_FROM = new Set(["app/pricing/compare/page.tsx", "app/pricing/layout.tsx"]);

describe("отменённые цены модулей не показываются гостю", () => {
  it("КОНТРОЛЬ прибора: файлы найдены и список слагов не пуст", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(Object.keys(НЕ_ПРОДАЁТСЯ_ОТДЕЛЬНО).length).toBeGreaterThanOrEqual(8);
    expect(files.map(rel)).toContain("app/compare/page.tsx");
  });

  it("fromPricePerMonth( вызывается только в проверенных файлах", () => {
    const bad = files.filter((f) => /fromPricePerMonth\(/.test(fs.readFileSync(f, "utf8")) && !РАЗРЕШЕНО_FROM.has(rel(f))).map(rel);
    expect(bad, "цена «от X/мес» из базы модуля у гостя; нужна цена Планеты (planetFromPerMonth)").toEqual([]);
  });

  it("файл со слагом не-для-продажи не читает его baseMonthly/termTotal", () => {
    const slugs = Object.keys(НЕ_ПРОДАЁТСЯ_ОТДЕЛЬНО);
    const bad: string[] = [];
    for (const f of files) {
      const s = fs.readFileSync(f, "utf8");
      const name = rel(f);
      if (name === "app/api/health/route.ts") continue; // отдаёт baseMonthly только после predlagaemOtdelno
      const mention = slugs.some((sl) => s.includes(`standaloneApp("${sl}"`) || s.includes(`standaloneApp('${sl}'`));
      if (mention && /baseMonthly|termTotal\(|termPricePerMonth\(/.test(s)) bad.push(name);
    }
    expect(bad).toEqual([]);
  });

  it("шахматная картинка запуска и /compare называют цену из плана/года", () => {
    const og = fs.readFileSync(path.join(ROOT, "app/cyberchess/launch/opengraph-image.tsx"), "utf8");
    expect(og).toContain("CHESS_YEARLY_USD");
    expect(og).not.toContain("baseMonthly");
    const cmp = fs.readFileSync(path.join(ROOT, "app/compare/page.tsx"), "utf8");
    expect(cmp).toContain("planetFromPerMonth");
    expect(cmp).not.toMatch(/DEVHUB_(BASE|MONTH|FROM)/);
  });
});
