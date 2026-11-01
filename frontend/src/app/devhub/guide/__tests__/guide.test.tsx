// /devhub/guide: язык текста чистый (en без кириллицы, kk без русских слов-маркеров),
// canonical = hreflang своего языка, канал seo-devhub в кнопках, страница в карте сайта, FAQ-разметка.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GuideView } from "../GuideView";
import {
  GUIDE,
  GUIDE_EXAMPLES,
  GUIDE_PRICING_HREF,
  GUIDE_STUDIO_HREF,
  guideFaqJsonLd,
  guideLang,
  guideMetadata,
  type GuideLang,
} from "../guideText";

const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const KK_ONLY = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
// Слова, которых в казахском нет.
const RU_WORDS = ["и", "что", "это", "или", "если", "как", "для", "через", "только", "можно", "чтобы", "ваш", "ваше", "который", "приложение", "проект", "страница", "бесплатно"];
const L = "[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]";
const RU_RE = new RegExp(`(?<!${L})(${RU_WORDS.join("|")})(?!${L})`, "i");
const видимыйТекст = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
const html = (l: GuideLang) => renderToStaticMarkup(<GuideView lang={l} />);

describe("страница /devhub/guide", () => {
  it("контроль приборов: кириллица и русские слова ловятся", () => {
    expect("Légal мат").toMatch(CYR);
    expect("Проект собирается через студию").toMatch(RU_RE);
    expect("жоба және тексеру").not.toMatch(RU_RE);
  });

  it("en: ни одной кириллической буквы ни в видимом тексте, ни в разметке, ни в мете", () => {
    const h = html("en");
    expect(h).not.toMatch(CYR);
    expect(JSON.stringify(guideMetadata("en"))).not.toMatch(CYR);
    expect(h).toContain("Honest limits");
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
      expect(String(m.alternates?.canonical)).toBe(`https://aevion.app/devhub/guide?lang=${l}`);
      expect(String(m.alternates?.canonical)).toBe(String((m.alternates?.languages as Record<string, string>)[l]));
      expect((m.alternates?.languages as Record<string, string>)["x-default"]).toBe("https://aevion.app/devhub/guide");
      expect(Object.keys(m.alternates?.languages ?? {}).sort()).toEqual(["en", "kk", "ru", "x-default"]);
      expect(String((m.openGraph as { url?: string }).url)).toBe(`https://aevion.app/devhub/guide?lang=${l}`);
      expect(String(m.title && (m.title as { absolute: string }).absolute).length).toBeGreaterThan(20);
    }
    expect(guideLang("de")).toBe("en");
    expect(guideLang("kk")).toBe("kk");
  });

  it("кнопки: основная в студию DevHub, вторая в цены, обе с c=seo-devhub", () => {
    expect(GUIDE_STUDIO_HREF).toBe("/devhub?c=seo-devhub");
    expect(GUIDE_PRICING_HREF).toBe("/pricing?c=seo-devhub");
    for (const l of ["en", "ru", "kk"] as const) {
      const h = html(l);
      expect(h).toContain(`href="${GUIDE_STUDIO_HREF}"`);
      expect(h).toContain(`href="${GUIDE_PRICING_HREF}"`);
    }
  });

  it("три примера — из витрины DevHub (examples.ts) и 5–7 вопросов в каждом языке", async () => {
    const { DEVHUB_EXAMPLES } = await import("../../examples");
    const живые = new Set(DEVHUB_EXAMPLES.map((e) => e.url));
    expect(GUIDE_EXAMPLES).toHaveLength(3);
    for (const e of GUIDE_EXAMPLES) expect(живые.has(e.url), e.url).toBe(true);
    for (const l of ["en", "ru", "kk"] as const) {
      expect(GUIDE[l].faq.length).toBeGreaterThanOrEqual(5);
      expect(GUIDE[l].faq.length).toBeLessThanOrEqual(7);
      expect(GUIDE[l].examples).toHaveLength(3);
      expect(GUIDE[l].steps).toHaveLength(5);
      const h = html(l);
      for (const e of GUIDE_EXAMPLES) expect(h).toContain(`href="${e.url}"`);
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

  it("честные пределы стоят в тексте; число минут не обещаем; нормы совпадают с бэком", () => {
    expect(GUIDE.en.limits.join(" ")).toMatch(/Next\.js, Express and Python/);
    expect(GUIDE.ru.limits.join(" ")).toMatch(/Next\.js, Express и Python/);
    for (const l of ["en", "ru", "kk"] as const) {
      expect(JSON.stringify(GUIDE[l])).not.toMatch(/\b\d+ ?(minutes|мин|минут)\b/i);
      expect(JSON.stringify(GUIDE[l])).not.toMatch(/\$\d/);
    }
    const бэк = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "..", "aevion-globus-backend", "src", "routes", "devhub.ts"), "utf8");
    expect(бэк).toMatch(/free:\s+\{ video: 3,\s+image: 10,\s+tts: 10000,\s+music: 5,\s+deploy: 10,\s+speech: 5,\s+translate: 50,\s+generate: 30 \}/);
    expect(GUIDE.en.faq[3].a).toContain("30 code generations, 10 publishes, 10 images, 5 music tracks and 3 videos");
  });

  it("страница есть в карте сайта", () => {
    const sm = readFileSync(join(__dirname, "..", "..", "..", "sitemap.ts"), "utf8");
    expect(sm).toContain('path: "/devhub/guide"');
  });
});
