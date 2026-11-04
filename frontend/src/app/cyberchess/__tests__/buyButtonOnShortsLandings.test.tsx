import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GuideView from "../guide/GuideView";
import TrapsView from "../traps/TrapsView";
import { BUY_LABEL, CHESS_CHECKOUT_BODY, CHESS_PRICING_FALLBACK } from "../BuyCyberChessButton";
import { CHESS_YEARLY_USD, TERM_MONTHS } from "@/lib/termPricing";

/**
 * 4.11.2026 (Оркестратор): до кассы LS с лендингов Shorts было 3 нажатия.
 * Кнопка «Купить CyberChess — $50/год» стоит на первом экране traps и guide
 * во всех трёх языках и ведёт в кассу тем же товаром, что /pricing?app=cyberchess.
 */
const LANGS = ["ru", "en", "kk"] as const;
const CYR = /[А-Яа-яЁё]/;

describe("кнопка покупки CyberChess на лендингах Shorts", () => {
  it("товар тот же, что на /pricing: app cyberchess, срок 12 месяцев, цена из termPricing", () => {
    expect(CHESS_CHECKOUT_BODY.app).toBe("cyberchess");
    expect(TERM_MONTHS[CHESS_CHECKOUT_BODY.tierId]).toBe(12);
    for (const l of LANGS) expect(BUY_LABEL[l]).toContain(`$${CHESS_YEARLY_USD}`);
    expect(BUY_LABEL.en).not.toMatch(CYR);
    expect(CHESS_PRICING_FALLBACK).toBe("/pricing?app=cyberchess");
  });

  it("на traps и guide кнопка в SSR-разметке первого экрана, ссылка-запасной путь несёт метку", () => {
    for (const l of LANGS) {
      const traps = renderToStaticMarkup(<TrapsView yazyk={l} />);
      const guide = renderToStaticMarkup(<GuideView yazyk={l} />);
      expect(traps).toContain(`data-testid="buy-cyberchess-traps"`);
      expect(traps).toContain(BUY_LABEL[l]);
      expect(traps).toContain(`href="/pricing?app=cyberchess&amp;c=seo-traps"`);
      // кнопка выше оглавления ловушек — первый экран
      expect(traps.indexOf("buy-cyberchess-traps")).toBeLessThan(traps.indexOf("<ol"));
      expect(guide.match(/data-testid="buy-cyberchess-guide"/g)?.length).toBe(1);
      expect(guide).toContain(BUY_LABEL[l]);
      expect(guide).toContain(`href="/pricing?app=cyberchess&amp;c=seo-cc-guide"`);
      expect(guide.indexOf("buy-cyberchess-guide")).toBeLessThan(guide.indexOf("<section"));
    }
  });
});
