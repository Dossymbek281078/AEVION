// /bureau/guide: язык текста чистый (en без кириллицы, kk без русских слов-маркеров),
// hreflang на три языка, канал seo-bureau в кнопках, страница в карте сайта, FAQ-разметка.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GuideView } from "../GuideView";
import {
  GUIDE,
  GUIDE_CONTACT_HREF,
  GUIDE_EXAMPLES,
  GUIDE_QRIGHT_HREF,
  guideFaqJsonLd,
  guideLang,
  guideMetadata,
  type GuideLang,
} from "../guideText";

const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const KK_ONLY = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
// Слова, которых в казахском нет (не берём «не», «бюро», «файл» — они бывают и там).
const RU_WORDS = ["и", "что", "это", "или", "если", "как", "для", "через", "только", "можно", "запись", "записи", "проверка", "проверки", "название", "описание", "чтобы", "ваш", "ваше", "вашем", "который"];
const L = "[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]";
const RU_RE = new RegExp(`(?<!${L})(${RU_WORDS.join("|")})(?!${L})`, "i");
const видимыйТекст = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
const html = (l: GuideLang) => renderToStaticMarkup(<GuideView lang={l} />);

describe("страница /bureau/guide", () => {
  it("контроль приборов: кириллица и русские слова ловятся", () => {
    expect("Légal мат").toMatch(CYR);
    expect("Запись сделана через бюро").toMatch(RU_RE);
    expect("жазба және тексеру").not.toMatch(RU_RE);
  });

  it("en: ни одной кириллической буквы ни в видимом тексте, ни в разметке, ни в мете", () => {
    const h = html("en");
    expect(h).not.toMatch(CYR);
    const m = guideMetadata("en");
    expect(String(JSON.stringify(m))).not.toMatch(CYR);
    expect(h).toContain("Record made via");
  });

  it("kk: нет русских слов-маркеров, есть казахские буквы в каждой строке текста", () => {
    const t = видимыйТекст(html("kk"));
    expect(t).not.toMatch(RU_RE);
    expect(t).toMatch(KK_ONLY);
    const k = GUIDE.kk;
    for (const s of [k.h1, k.lead, ...k.steps.map((x) => x.p), ...k.limits, ...k.faq.map((f) => f.a)]) {
      expect(s, s).toMatch(KK_ONLY);
    }
    expect(JSON.stringify(guideMetadata("kk"))).not.toMatch(RU_RE);
  });

  it("ru: без казахских букв; три языка не совпадают", () => {
    expect(видимыйТекст(html("ru"))).not.toMatch(KK_ONLY);
    expect(GUIDE.ru.h1).not.toBe(GUIDE.kk.h1);
    expect(GUIDE.ru.h1).not.toBe(GUIDE.en.h1);
  });

  it("мета: canonical свой у каждого языка (= его hreflang) и hreflang en/ru/kk + x-default у всех трёх языков", () => {
    for (const l of ["en", "ru", "kk"] as const) {
      const m = guideMetadata(l);
      expect(String(m.alternates?.canonical)).toBe(`https://aevion.app/bureau/guide?lang=${l}`);
      expect(String(m.alternates?.canonical)).toBe(String((m.alternates?.languages as Record<string, string>)[l]));
      expect(Object.keys(m.alternates?.languages ?? {}).sort()).toEqual(["en", "kk", "ru", "x-default"]);
      expect(String(m.title && (m.title as { absolute: string }).absolute).length).toBeGreaterThan(20);
    }
    expect(guideLang("de")).toBe("en");
    expect(guideLang("kk")).toBe("kk");
  });

  it("кнопки: основная на заявку бюро, вторая в QRight, обе с c=seo-bureau", () => {
    expect(GUIDE_CONTACT_HREF).toBe("/pricing/contact?topic=bureau&app=ip_bureau&c=seo-bureau");
    expect(GUIDE_QRIGHT_HREF).toBe("/qright?c=seo-bureau");
    for (const l of ["en", "ru", "kk"] as const) {
      const h = html(l);
      expect(h).toContain(`href="${GUIDE_CONTACT_HREF.replace(/&/g, "&amp;")}"`);
      expect(h).toContain(`href="${GUIDE_QRIGHT_HREF}"`);
    }
  });

  it("три примера записей и 5–7 вопросов в каждом языке", () => {
    expect(GUIDE_EXAMPLES).toHaveLength(3);
    expect(GUIDE_EXAMPLES[0].id).toBe("cert-c6b05b8930357a03");
    for (const l of ["en", "ru", "kk"] as const) {
      expect(GUIDE[l].faq.length).toBeGreaterThanOrEqual(5);
      expect(GUIDE[l].faq.length).toBeLessThanOrEqual(7);
      expect(GUIDE[l].examples).toHaveLength(3);
      expect(GUIDE[l].steps).toHaveLength(5);
      expect(GUIDE[l].limits).toHaveLength(3);
      const h = html(l);
      for (const e of GUIDE_EXAMPLES) expect(h).toContain(`href="/verify/${e.id}"`);
    }
  });

  it("FAQPage JSON-LD: тип, число вопросов, язык", () => {
    for (const l of ["en", "ru", "kk"] as const) {
      const j = guideFaqJsonLd(l);
      expect(j["@type"]).toBe("FAQPage");
      expect(j.mainEntity).toHaveLength(GUIDE[l].faq.length);
      expect(j.inLanguage).toBe(l);
      expect(html(l)).toContain('"@type":"FAQPage"');
    }
  });

  it("честные пределы стоят в тексте: не замена ведомству, не личность, название публично", () => {
    expect(GUIDE.en.limits.join(" ")).toMatch(/not a registration at a patent office/);
    expect(GUIDE.en.limits.join(" ")).toMatch(/public and are part of the signed hash/);
    expect(GUIDE.ru.limits.join(" ")).toMatch(/входят в подписанный хеш/);
    // число минут не обещаем
    for (const l of ["en", "ru", "kk"] as const) expect(JSON.stringify(GUIDE[l])).not.toMatch(/\b2 ?(minutes|мин)/i);
  });

  it("страница есть в карте сайта", () => {
    const sm = readFileSync(join(__dirname, "..", "..", "..", "sitemap.ts"), "utf8");
    expect(sm).toContain('path: "/bureau/guide"');
  });
});
