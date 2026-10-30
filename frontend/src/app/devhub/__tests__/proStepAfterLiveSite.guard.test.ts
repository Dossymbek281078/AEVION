// Платная ступень DevHub в потоке гостя: после живого сайта, а не только при отказе.
// Замер прода f2db0ee93 30.10.2026 (390, чистый браузер): идея → сайт → «Выкатить» →
// живой адрес — и ни цены, ни кнопки оплаты; плашка кассы жила только при
// исчерпанной квоте. Сторож ИСХОДНИКА (форма); что человек видит — браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEVHUB_DICT } from "../i18n";

const src = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");
const i = src.indexOf("data-devhub-pro-after-live");
const block = src.slice(src.lastIndexOf("{(pagesResult?.liveUrl", i), src.indexOf("</Link>", i));

describe("DevHub: ступень «Планета» сразу под живым адресом", () => {
  it("блок есть и стоит ПОСЛЕ показа живого адреса", () => {
    expect(i).toBeGreaterThan(0);
    expect(i).toBeGreaterThan(src.indexOf("{GL.openSite} →"));
  });
  it("показывается при живом адресе и не показывается платящему", () => {
    expect(block).toContain('тарифСтудии != null && тарифСтудии !== "pro" && тарифСтудии !== "enterprise"');
  });
  it("тариф не загрузился → ступени нет, отказ не проглочен", () => {
    const i = src.indexOf("setТарифСтудии(d.tier)");
    const окно = src.slice(i, i + 700);
    expect(окно).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*(\/\*.*?\*\/)?\s*\}\)/);
    expect(окно).toContain("console.warn(\"[devhub] тариф для ступени «Планета» не прочитан:\"");
    expect(block).toContain("pagesResult?.liveUrl");
  });
  it("кнопка ведёт к срокам «Планеты» и пишет checkout_start со своим источником", () => {
    expect(block).toContain("href={PLANET_TERMS_LIST}");
    expect(block).toMatch(/type: "checkout_start", tier: "studio-pro", source: "devhub-after-live"/);
    expect(block).toContain('href="/devhub/link"');
  });
  it("цена «без обязательства» — Планеты, не старой базы DevHub (приёмка 30.10: $200 против $250 в баннере)", () => {
    expect(block).toContain("planetPricePerMonth(СРОК_ПО_УМОЛЧАНИЮ)");
    expect(block).not.toContain("pricePerMonth(STUDIO_PRO)");
  });
  it("плашка при 402 (upgradeNudge) тоже называет цену Планеты: во всём файле нет pricePerMonth(STUDIO_PRO) в тексте срока", () => {
    expect(src).not.toContain("${pricePerMonth(STUDIO_PRO)}");
  });
  it("тариф спрашивается с Bearer, как на /devhub", () => {
    expect(src).toMatch(/fetch\(apiUrl\("\/api\/devhub\/studio\/credits"\), \{ cache: "no-store", headers: токен \? \{ Authorization: "Bearer " \+ токен \} : \{\} \}\)[\s\S]{0,120}setТарифСтудии/);
  });
  it("текст есть на ru/en/kk и называет причину платить — значок и предел выкладок", () => {
    for (const lang of ["ru", "en", "kk"]) {
      const t = DEVHUB_DICT[lang]?.["pro.afterLive" as never] as string | undefined;
      expect(t, lang).toBeTruthy();
      expect(t).toContain("AEVION");
      expect(t).toContain("{n}");
    }
  });
});
