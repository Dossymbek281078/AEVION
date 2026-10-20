/**
 * AEVIA: ни «LIVE», ни обещаний про здоровье — на ВСЕХ поверхностях.
 *
 * 🔴 20.10.2026 (решение Оркестратора). У AEVIA стояли «▲ LIVE» и «Live venture · живой
 * венчур», а купить нечего: ни кассы, ни предзаказа, юнит-экономика расчётная. В описании
 * БАДа — «клеточный возраст», «против седины», «клеточное обновление». Без клинических
 * данных с источником это юридический риск. Поверхности: страница /ventures (текст и
 * metadata), карточка идеи 01 на сайте и в API, описание модуля в реестре проектов.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const корень = join(__dirname, "..", "..", "..", "..", "..");
const ПОВЕРХНОСТИ = [
  "frontend/src/app/ventures/page.tsx",
  "frontend/src/app/ventures/IdeaMarket.tsx",
  "frontend/src/app/ventures/TopIdeas.tsx",
  "aevion-globus-backend/src/routes/ventures.ts",
  "aevion-globus-backend/src/data/projects.ts",
  "aevion-globus-backend/src/data/pricing.ts",
  "frontend/src/lib/pricingLocalize.ts",
].map((p) => {
  const s = readFileSync(join(корень, p), "utf8");
  // Общие реестры (projects/pricing) несут и чужие модули (qrenew, qmelanin…) — там берём только строки ventures/AEVIA.
  const общий = !p.includes("/ventures");
  return [p, общий ? s.split("\n").filter((l) => /AEVIA|ventures|Идея-Маркет|Idea Market/i.test(l)).join("\n") : s] as const;
});

describe("AEVIA: без «LIVE» и без обещаний про здоровье", () => {
  it("все поверхности прочитаны", () => {
    expect(ПОВЕРХНОСТИ.every(([, s]) => s.length > 40)).toBe(true);
  });
  it("слов «клеточн|cellular|омолож|anti-aging|антиэйдж|против седины» нет на поверхностях ventures", () => {
    const плохо = ПОВЕРХНОСТИ.flatMap(([p, s]) =>
      [...s.matchAll(/клеточн|cellular|омолож|anti-?aging|антиэйдж|против седины/giu)].map((m) => `${p}: ${m[0]}`),
    );
    expect(плохо).toEqual([]);
  });
  it("AEVIA нигде не «live»: ни статус идеи, ни подпись, ни описание", () => {
    const плохо = ПОВЕРХНОСТИ.flatMap(([p, s]) =>
      s.split("\n").filter((l) => /AEVIA/.test(l) && /status: "live"|\bLIVE\b|live venture|живой венчур|живая ставка|уже запущена/i.test(l)).map((l) => `${p}: ${l.trim().slice(0, 120)}`),
    );
    const подписи = ПОВЕРХНОСТИ.flatMap(([p, s]) => (/Live venture|Живая ставка|живой венчур/i.test(s) ? [p] : []));
    expect([...плохо, ...подписи]).toEqual([]);
  });
  it("юнит-экономика подписана как расчёт", () => {
    const стр = ПОВЕРХНОСТИ[0][1];
    expect(стр).toContain("Юнит-экономика · расчёт, не факт");
    expect(стр).toContain("продаж AEVIA пока нет");
  });
});
