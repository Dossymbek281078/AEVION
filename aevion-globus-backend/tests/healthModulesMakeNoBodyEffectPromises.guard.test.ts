import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: модули здоровья не обещают действия на тело без источника.
 *
 * 🔴 20.10.2026 (решение Оркестратора). На витринах стояли «Программа клеточного
 * обновления», «Седина — маркер старения стволовых клеток», «Протокол против седины»,
 * «Longevity & Anti-Aging», «Живи дольше, старей медленнее», а гайд описывался как
 * «что реально её замедляет». Без клинических данных с источником это юридический
 * риск. Гайд «The Anti-Grey Protocol» продаётся дальше: вместо обещания — что внутри
 * (по самому PDF) и «Не медицинская консультация, результат не гарантирован».
 * Поверхности: страницы, metadata/og, реестры (projects/pricing/explore), тексты
 * товаров ru/en, ответы API и подсказка ИИ QLife.
 */
const корень = join(__dirname, "..", "..");
const ПОВЕРХНОСТИ = [
  "frontend/src/components/HealthDisclaimer.tsx",
  "frontend/src/app/explore/page.tsx",
  "frontend/src/app/qlife/page.tsx",
  "frontend/src/app/qlife/layout.tsx",
  "frontend/src/app/qlife/opengraph-image.tsx",
  "frontend/src/app/qlife/components/PlanCard.tsx",
  "frontend/src/app/qmelanin/_client.tsx",
  "frontend/src/app/qmelanin/layout.tsx",
  "frontend/src/app/qrenew/_client.tsx",
  "frontend/src/app/qrenew/layout.tsx",
  "frontend/src/app/en/longevity/page.tsx",
  "frontend/src/app/tiktok-publisher/page.tsx",
  "frontend/src/data/demoNarrative.ts",
  "frontend/src/data/pitchModel.ts",
  "frontend/src/lib/pricingLocalize.ts",
  "frontend/src/lib/products.ts",
  "frontend/src/lib/enTexts.ts",
  "aevion-globus-backend/src/data/pricing.ts",
  "aevion-globus-backend/src/data/projects.ts",
  "aevion-globus-backend/src/routes/qlife.ts",
  "aevion-globus-backend/src/routes/qrenew.ts",
  "aevion-globus-backend/src/routes/qmelanin.ts",
].map((p) => [p, readFileSync(join(корень, p), "utf8")] as const);

const комментарий = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);
const ОБЕЩАНИЯ = /клеточн\p{L}*\s+(обновлен|возраст|здоровь)|anti-?gr[ae]ying|омолож|anti-?aging|анти-?эйдж|антиэйдж|против седины|cellular|rejuvenat|стволов|stem.?cell|старей медленнее|живи дольше|what actually slows it|что реально её замедляет|AEVIA Roots — ссылка/iu;
// Разрешено: научное название признака старения с источником и прямой ЗАПРЕТ обещаний в подсказке ИИ.
const МОЖНО = (l: string) => /López-Otín/.test(l) || /Never promise outcomes/.test(l);

describe("модули здоровья: без обещаний действия на тело", () => {
  it("все поверхности прочитаны", () => {
    expect(ПОВЕРХНОСТИ.every(([, s]) => s.length > 200)).toBe(true);
  });
  it("ни одного обещания вне комментариев", () => {
    const плохо = ПОВЕРХНОСТИ.flatMap(([p, s]) =>
      s.split("\n").filter((l) => !комментарий(l) && ОБЕЩАНИЯ.test(l) && !МОЖНО(l)).map((l) => `${p}: ${l.trim().slice(0, 140)}`),
    );
    expect(плохо).toEqual([]);
  });
  it("гайд описан по содержанию и с оговоркой «результат не гарантирован» (ru и en)", () => {
    const товары = ПОВЕРХНОСТИ.find(([p]) => p.endsWith("lib/products.ts"))![1];
    expect(товары).toContain("Не медицинская консультация, результат не гарантирован.");
    expect(товары).toContain("Not medical advice; results not guaranteed.");
    expect(товары).toContain("Nature 2023, FASEB J 2009, Nature 2020");
    const en = ПОВЕРХНОСТИ.find(([p]) => p.endsWith("lib/enTexts.ts"))![1];
    expect(en.split("results not guaranteed").length - 1).toBeGreaterThanOrEqual(2);
  });
  it("общий дисклеймер говорит «Результат не гарантирован», и он стоит на QLife", () => {
    expect(ПОВЕРХНОСТИ[0][1]).toContain("Результат не гарантирован.");
    expect(ПОВЕРХНОСТИ.find(([p]) => p.endsWith("qlife/page.tsx"))![1]).toContain("<HealthDisclaimer />");
  });
  it("подсказка ИИ QLife запрещает обещать результат", () => {
    expect(ПОВЕРХНОСТИ.find(([p]) => p.endsWith("routes/qlife.ts"))![1]).toContain("Never promise outcomes, rejuvenation or reversal of aging");
  });
});
