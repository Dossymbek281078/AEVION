import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NOTES_EN } from "@/lib/pricingLocalize";
import { translations } from "@/lib/i18n-all";
import { PLANET_PREPAY_DISCOUNT_PERCENT } from "@/lib/termPricing";

/**
 * 🔴 20.10.2026: план «Планета» списывается ЕЖЕМЕСЯЧНО при обязательстве на срок,
 * весь срок вперёд — только вариант со скидкой (слово основателя 19.10). На
 * поверхностях покупателя оставались обещания «оплата за срок вперёд» как
 * ЕДИНСТВЕННОГО способа: примечание /api/pricing (и его перевод NOTES_EN),
 * OG-картинка срока, описание /pricing, подсказка чипа модуля, баннер апгрейда,
 * FAQ конституции («Ежемесячных списаний нет»), FAQ карточки срока, /apps,
 * /en/go, /qcoreai/upgrade, /constitution/demo, enTexts.
 *
 * Сторож держит две вещи:
 *   1. примечание бэка (строится с процентом из данных) имеет перевод: ключ
 *      NOTES_EN равен тексту, который отдаёт бэк;
 *   2. в коде витрины (кроме комментариев и материалов для инвесторов) нет
 *      фраз «только вперёд».
 */
const ROOT = join(__dirname, "..", "..", "..", "..", "..");
const SRC = join(ROOT, "frontend", "src");

const ЗАПРЕТ =
  /оплат[а-яё]* за (?:выбранный )?срок вперёд|оплачивается за выбранный срок вперёд|за весь срок вперёд<|\{tier\.total\} за весь срок вперёд|paid up front|pay for the (?:whole )?term up ?front|You pay for the term upfront|One payment for the (?:full |whole )?term|There is no monthly|Ежемесячных списаний нет|no monthly charges/i;

/** Материалы для инвесторов (ARPU места = сумма за срок), не обещание покупателю. */
const ВНЕ_ВИТРИНЫ = new Set(["data/pitchModel.ts", "data/pitchFacts.ts"]);

function строкиКода(): Array<{ file: string; line: number; text: string }> {
  const out: Array<{ file: string; line: number; text: string }> = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== "node_modules" && n !== "__tests__") walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(n) || /\.test\./.test(n)) continue;
      const rel = p.slice(SRC.length + 1).replace(/\\/g, "/");
      if (ВНЕ_ВИТРИНЫ.has(rel)) continue;
      readFileSync(p, "utf8").split("\n").forEach((text, i) => {
        if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(text)) return; // комментарий
        out.push({ file: rel, line: i + 1, text });
      });
    }
  };
  walk(SRC);
  return out;
}

describe("обещание срока: списание ежемесячно, вперёд — скидка", () => {
  it("КОНТРОЛЬ прибора: обход видит код и запрет срабатывает на прежних фразах", () => {
    const строки = строкиКода();
    expect(строки.length).toBeGreaterThan(100_000);
    expect(ЗАПРЕТ.test("Оплата за срок вперёд; чем длиннее срок")).toBe(true);
    expect(ЗАПРЕТ.test("{tier.total} за весь срок вперёд")).toBe(true);
    expect(ЗАПРЕТ.test("Every module · a term of 1 to 12 months · paid up front")).toBe(true);
    expect(ЗАПРЕТ.test("Оплатить весь срок вперёд — {total}")).toBe(false);
    expect(ЗАПРЕТ.test("Или весь срок вперёд одним платежом")).toBe(false);
  });

  it("в коде витрины нет обещаний «только вперёд»", () => {
    const находки = строкиКода().filter((s) => ЗАПРЕТ.test(s.text)).map((s) => `${s.file}:${s.line} ${s.text.trim().slice(0, 120)}`);
    expect(находки).toEqual([]);
  });

  it("словари ru/en/kk: ни одно значение не обещает «только вперёд»", () => {
    const находки: string[] = [];
    let всего = 0;
    for (const [lang, dict] of Object.entries(translations)) {
      for (const [k, v] of Object.entries(dict as Record<string, string>)) {
        всего++;
        if (typeof v === "string" && ЗАПРЕТ.test(v)) находки.push(`${lang} ${k}`);
      }
    }
    expect(всего).toBeGreaterThan(10_000);
    expect(находки).toEqual([]);
  });

  it("примечание бэка о сроке переведено: ключ NOTES_EN = текст, который строит /api/pricing", () => {
    const бэк = readFileSync(join(ROOT, "aevion-globus-backend", "src", "routes", "pricing.ts"), "utf8");
    const m = /`(Тариф — это срок обязательства:[^`]*)`/.exec(бэк);
    expect(m, "примечание о сроке в routes/pricing.ts").not.toBeNull();
    const текст = m![1].replace(
      '${String(PLANET_PREPAY_DISCOUNT_PERCENT.max).replace(".", ",")}',
      String(PLANET_PREPAY_DISCOUNT_PERCENT.max).replace(".", ","),
    );
    expect(текст).not.toContain("${");
    expect(текст).toContain("Списание ежемесячно");
    expect(NOTES_EN[текст], "перевода примечания нет — en покажет русский текст").toMatch(/Billed monthly/);
  });

  it("OG-картинка срока говорит «списание ежемесячно» и называет месяцы", () => {
    const og = readFileSync(join(SRC, "app", "pricing", "[tierId]", "opengraph-image.tsx"), "utf8");
    expect(og).toContain("{tier.total} за {tier.months} мес., списание ежемесячно");
    expect(og).toContain("months: TERM_MONTHS[term],");
  });
});
