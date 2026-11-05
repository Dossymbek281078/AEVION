import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    expect(panel).toContain("за $50/год");
    const list = panel.slice(panel.indexOf('data-testid="cc-paid-features"'), panel.indexOf("</ul>"));
    expect((list.match(/<li>/g) || []).length).toBe(5);
    expect(list).toMatch(/Уровни ИИ 5–6/);
    expect(page).toMatch(/\(chessy\.owned\.master_ai\|\|isPro\)\?6:4/);
    expect(list).toMatch(/Ghost-подсказки без монет/);
    expect(page).toMatch(/return isPro\?0:15;/);
    expect(list).toMatch(/Глубокий разбор партии без монет/);
    expect(page).toMatch(/cost:isPro\?0:20/);
    expect(list).toMatch(/Значок Pro/);
    expect(page).toMatch(/"Pro активен"/);
    expect(list).toMatch(/NNUE/);
    expect(panel).toMatch(/checkAppAccess\("cyberchess"\)/);
  });
  it("слова «пока недоступен» больше нет; кнопка ведёт на цены CyberChess с меткой", () => {
    expect(panel).not.toContain("пока недоступен");
    expect(panel).toMatch(/keepChannel\(PRICING_APP\("cyberchess"\), channelNow\(\)\)/);
  });
});
