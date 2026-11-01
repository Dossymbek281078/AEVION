// Страница сравнения ответов нейросетей: тексты без смеси языков, нет обещаний, которых нет в продукте,
// мета (canonical/hreflang), адреса /en и /kk не уводит middleware, кнопки несут ?c=seo-compare,
// пример со страницы вписывается в поле консоли (?q=).
import { describe, it, expect } from "vitest";
import { COMPARE_TEXT, askHref, pricingHref } from "../compareText";
import { compareMetadata, COMPARE_PATHS } from "../meta";
import { faqJsonLd } from "../CompareView";
import { вопросИзАдреса } from "../../MultichatEngineClient";
import { hasOwnEnglishPage } from "@/lib/englishPages";
import { языковойРедирект } from "@/middleware";

const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const KK_ONLY = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const LANGS = ["ru", "en", "kk"] as const;
const всё = (l: (typeof LANGS)[number]) => JSON.stringify(COMPARE_TEXT[l]);

describe("страница сравнения Мультичата", () => {
  it("en без кириллицы, ru без казахских букв, kk — свой текст с казахскими буквами", () => {
    expect(всё("en")).not.toMatch(CYR);
    expect(всё("ru")).not.toMatch(KK_ONLY);
    expect(всё("kk")).toMatch(KK_ONLY);
    expect(всё("kk")).not.toBe(всё("ru"));
  });

  it("контроль прибора: кириллица в en ловится", () => {
    expect("Claude совет").toMatch(CYR);
  });

  it("на всех языках одинаковое число шагов, примеров и вопросов", () => {
    for (const l of LANGS) {
      const t = COMPARE_TEXT[l];
      expect(t.examples).toHaveLength(3);
      expect(t.faq.length).toBe(COMPARE_TEXT.en.faq.length);
      expect(t.method.length).toBe(COMPARE_TEXT.en.method.length);
      expect(t.how.length).toBe(COMPARE_TEXT.en.how.length);
    }
  });

  it("1.11 (Продажи): title и h1 не называют ChatGPT — его в совете нет; названы Claude и Gemini", () => {
    for (const l of ["ru", "en", "kk"] as const) {
      const title = String(compareMetadata(l).title);
      expect(title).not.toMatch(/ChatGPT/);
      expect(title).toMatch(/Claude/);
      expect(title).toMatch(/Gemini/);
      expect(COMPARE_TEXT[l].h1).not.toMatch(/ChatGPT/);
    }
  });

  it("не обещает лишнего: ChatGPT назван отсутствующим, нет оценок «лучше» и процентов качества", () => {
    // Совет — Claude, Gemini и открытая модель через OpenRouter (CouncilConsole.tsx); OpenAI там нет.
    expect(COMPARE_TEXT.en.honest).toMatch(/ChatGPT is not part of the council/);
    expect(COMPARE_TEXT.ru.honest).toMatch(/ChatGPT сейчас в совет не входит/);
    expect(COMPARE_TEXT.kk.honest).toMatch(/ChatGPT қазір кеңеске кірмейді/);
    for (const l of LANGS) {
      // Единственные числа на странице — норма «2 вопроса», «3 агента», шаги и примеры; никаких «% точности».
      expect(всё(l)).not.toMatch(/\d+\s?%\s*(accura|точн|дәл)/i);
    }
    expect(всё("en")).not.toMatch(/\b(best model|smarter than|more accurate than)\b/i);
  });

  it("кнопки: свой язык, метка ?c=seo-compare, пример вписывается вопросом ?q=", () => {
    expect(askHref("ru")).toBe("/multichat-engine?c=seo-compare");
    expect(askHref("en")).toBe("/multichat-engine?lang=en&c=seo-compare");
    expect(askHref("kk")).toBe("/multichat-engine?lang=kk&c=seo-compare");
    const q = COMPARE_TEXT.en.examples[0].q;
    const href = askHref("en", q);
    expect(new URL(href, "https://aevion.app").searchParams.get("q")).toBe(q);
    expect(вопросИзАдреса(new URL(href, "https://aevion.app").search)).toBe(q);
    expect(pricingHref("ru")).toBe("/pricing?c=seo-compare#planet-buy");
    expect(pricingHref("en")).toBe("/pricing?lang=en&c=seo-compare#planet-buy");
  });

  it("вопрос из адреса: короткий не подставляется, длинный обрезается до 500", () => {
    expect(вопросИзАдреса("?q=hi")).toBeNull();
    expect(вопросИзАдреса("")).toBeNull();
    expect(вопросИзАдреса("?q=" + "a".repeat(900))?.length).toBe(500);
    expect(вопросИзАдреса("?c=x&q=%D0%9A%D0%B0%D0%BA%20%D0%B4%D0%B5%D0%BB%D0%B0%3F")).toBe("Как дела?");
  });

  it("мета: canonical на себя, hreflang ru/en/kk + x-default, en без кириллицы", () => {
    for (const l of LANGS) {
      const m = compareMetadata(l);
      expect(String(m.alternates?.canonical)).toBe("https://aevion.app" + COMPARE_PATHS[l]);
      expect(Object.keys(m.alternates?.languages ?? {}).sort()).toEqual(["en", "kk", "ru", "x-default"]);
      expect(String(m.title).length).toBeLessThanOrEqual(100);
    }
    const en = compareMetadata("en");
    expect(String(en.title) + en.description).not.toMatch(CYR);
  });

  it("FAQ для поисковика — те же вопросы, что на экране, и без закрывающего </script>", () => {
    for (const l of LANGS) {
      const ld = JSON.parse(faqJsonLd(l));
      expect(ld["@type"]).toBe("FAQPage");
      expect(ld.mainEntity.map((x: { name: string }) => x.name)).toEqual(COMPARE_TEXT[l].faq.map((f) => f.q));
      expect(faqJsonLd(l)).not.toMatch(/<\/script/i);
    }
  });

  it("middleware не уводит /en и /kk страницы сравнения", () => {
    expect(hasOwnEnglishPage("/en/multichat-engine/compare")).toBe(true);
    expect(языковойРедирект("/kk/multichat-engine/compare")).toBeNull();
    // контроль: соседний экран без своей kk-страницы по-прежнему уводится
    expect(языковойРедирект("/kk/multichat-engine/library")).not.toBeNull();
  });
});
