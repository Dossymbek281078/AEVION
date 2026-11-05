import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ruOf } from "./_ruSlovar";

/**
 * 4.11.2026 (Оркестратор, деньги): CyberChess продаётся за $50/год, но ни замок,
 * ни цены не говорили, что открывается. Состав — только подтверждённое кодом:
 * page.tsx гейтит по isPro уровни ИИ 5–6, цену Ghost-подсказки (0 вместо 15)
 * и Глубокого разбора (0 вместо 20), значок Pro; панель NNUE — по доступу.
 */
const panel = readFileSync(join(__dirname, "..", "DeepAnalysisPanel.tsx"), "utf8");
const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("замок глубокого анализа называет цену и состав", () => {
  it("цена $50/год и пять пунктов, каждый подтверждён гейтом в page.tsx", () => {
    // 5.11.2026: подписи — ключи cpn.deep.* (ru-значения те же, en/kk рядом)
    expect(panel).toContain('cc.t("cpn.deep.lock")');
    expect(ruOf("cpn.deep.lock")).toContain("за $50/год");
    const list = panel.slice(panel.indexOf('data-testid="cc-paid-features"'), panel.indexOf("</ul>"));
    expect((list.match(/<li>/g) || []).length).toBe(5);
    expect(list).toContain('cc.t("cpn.deep.f.levels")');
    expect(ruOf("cpn.deep.f.levels")).toMatch(/Уровни ИИ 5–6/);
    expect(page).toMatch(/\(chessy\.owned\.master_ai\|\|isPro\)\?6:4/);
    expect(list).toContain('cc.t("cpn.deep.f.ghost")');
    expect(ruOf("cpn.deep.f.ghost")).toMatch(/Ghost-подсказки без монет/);
    expect(page).toMatch(/return isPro\?0:15;/);
    expect(list).toContain('cc.t("cpn.deep.f.review")');
    expect(ruOf("cpn.deep.f.review")).toMatch(/Глубокий разбор партии без монет/);
    expect(page).toMatch(/cost:isPro\?0:20/);
    expect(list).toContain('cc.t("cpn.deep.f.badge")');
    expect(ruOf("cpn.deep.f.badge")).toMatch(/Значок Pro/);
    expect(page).toMatch(/"Pro активен"/);
    expect(list).toContain('cc.t("cpn.deep.f.nnue")');
    expect(ruOf("cpn.deep.f.nnue")).toMatch(/NNUE/);
    expect(panel).toMatch(/checkAppAccess\("cyberchess"\)/);
  });
  it("слова «пока недоступен» больше нет; кнопка ведёт на цены CyberChess с меткой", () => {
    expect(panel).not.toContain("пока недоступен");
    expect(panel).toMatch(/keepChannel\(PRICING_APP\("cyberchess"\), channelNow\(\)\)/);
  });
});
