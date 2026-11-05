// Страница о тренере: примеры — настоящие ходы-зевки из traps.ts, кнопки несут ?c=seo-cc-guide,
// мета с canonical на себя и hreflang на три языка, FAQPage, middleware не уводит /en и /kk,
// глубокий NNUE-анализ (не работает на проде) не обещан.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Chess } from "chess.js";
import GuideView from "../GuideView";
import { GUIDE, GUIDE_EXAMPLES, GUIDE_PATHS, coachHref, guideFaqJsonLd, guideMetadata, PRICING_HREF } from "../guide";
import { LOVUSHKI } from "../../traps/traps";
import { hasOwnEnglishPage } from "@/lib/englishPages";
import { языковойРедирект } from "@/middleware";

const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const KK_ONLY = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const LANGS = ["ru", "en", "kk"] as const;

describe("/cyberchess/guide", () => {
  it("примеры: ход-ошибка совпадает с ловушкой, ход легален и стоит в тексте всех языков", () => {
    for (const e of GUIDE_EXAMPLES) {
      const t = LOVUSHKI.find((x) => x.id === e.id)!;
      expect(t, e.id).toBeTruthy();
      expect(t.moves[t.oshibka]).toBe(e.san);
      const c = new Chess();
      for (const s of t.moves.slice(0, t.oshibka + 1)) c.move(s);
    }
    for (const l of LANGS) GUIDE_EXAMPLES.forEach((e, i) => expect(GUIDE[l].examples[i]).toContain(e.san + "??"));
  });

  it("кнопки: свой языковой адрес тренера и касса с ?c=seo-cc-guide", () => {
    expect(coachHref("ru")).toBe("/cyberchess?c=seo-cc-guide");
    expect(coachHref("en")).toBe("/en/cyberchess?c=seo-cc-guide");
    expect(coachHref("kk")).toBe("/kk/cyberchess?c=seo-cc-guide");
    expect(PRICING_HREF).toBe("/pricing?app=cyberchess&c=seo-cc-guide");
  });

  for (const l of LANGS) {
    it(`${l}: рендер с кнопками, примерами, ссылкой на ловушки и FAQPage`, () => {
      const html = renderToStaticMarkup(<GuideView yazyk={l} />);
      expect(html).toContain(`href="${coachHref(l)}"`);
      expect(html).toContain(`href="${PRICING_HREF.replace(/&/g, "&amp;")}"`);
      expect(html.match(/data-testid="ccg-example"/g)).toHaveLength(3);
      expect(html).toContain(`href="${l === "ru" ? "" : "/" + l}/cyberchess/traps"`);
      expect(html).toContain('"@type":"FAQPage"');
      expect(guideFaqJsonLd(l).mainEntity).toHaveLength(GUIDE[l].faq.length);
      expect(html).toContain("$50");
      // 31.10 NNUE не обещали (сети /nnue были 404). 5.11: сети на проде, панель у оплатившего считает
      // (подписанный вебхук LS + Playwright, +0.30 на глубине 18) — список «за $50/год» с NNUE стоит на первом экране.
      expect(html).toContain('data-testid="cc-paid-features"');
      expect(html).toMatch(/NNUE/);
    });
  }

  it("тексты без смеси языков", () => {
    expect(JSON.stringify(GUIDE.en)).not.toMatch(CYR);
    expect(JSON.stringify(GUIDE.ru)).not.toMatch(KK_ONLY);
    expect(JSON.stringify(GUIDE.kk)).toMatch(KK_ONLY);
  });

  it("контроль прибора: кириллица в en ловится", () => {
    expect("coach тренер").toMatch(CYR);
  });

  it("мета: canonical на себя, hreflang ru/en/kk/x-default", () => {
    for (const l of LANGS) {
      const m = guideMetadata(l);
      expect(String(m.alternates?.canonical)).toBe("https://aevion.app" + GUIDE_PATHS[l]);
      expect(Object.keys(m.alternates?.languages ?? {}).sort()).toEqual(["en", "kk", "ru", "x-default"]);
    }
  });

  it("middleware не уводит /en и /kk страницы о тренере", () => {
    expect(hasOwnEnglishPage("/en/cyberchess/guide")).toBe(true);
    expect(языковойРедирект("/kk/cyberchess/guide")).toBeNull();
    expect(языковойРедирект("/kk/cyberchess/daily")).not.toBeNull();
  });
});
