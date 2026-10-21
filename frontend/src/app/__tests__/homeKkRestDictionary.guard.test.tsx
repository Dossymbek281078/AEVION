// 🔴 21.10.2026 (окно Приложения, задача оркестратора): остаток kk-главной после шапки и подвала —
// 10 латинских строк на каждой из 5 пар окон (yazyk-glavnaya-porog.mjs на ee436fb36): инвест-блок,
// блок конституции, ряды ссылок на модули, «Next + Node + PG». Блок конституции был русскими
// литералами — en видел его английским только через живой перевод (пауза DeepL → русский).
// Сторож держит: словари полны на ru/en/kk; в kk нет английских фраз вне списка имён;
// русские литералы блока и английские фразы инвест-блока не вернулись в _home.tsx;
// виджет конституции с явным языком говорит на нём, без языка — прежний русский (контроль).
import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { HOME_TEXT } from "@/data/homeTexts";
import { INVEST_CARDS, INVEST_HEAD } from "@/data/homeInvest";
import { BRAND_NAMES } from "@/data/moduleNames";
import { REGIME_TEXT, SHORT_LABELS } from "@/lib/constitutionI18n";
import { SLIDER_SHORT_LABELS } from "@/lib/constitution";
import { ConstitutionEmbed } from "@/components/ConstitutionEmbed";

const ROOT = process.cwd();
const HOME = fs.readFileSync(path.join(ROOT, "src", "app", "_home.tsx"), "utf8");
const CONST = fs.readFileSync(path.join(ROOT, "src", "lib", "constitution.ts"), "utf8");
const OA = { floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80, multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80 };

/** Тот же признак, что у прибора порога: после вычёркивания имён осталась английская фраза из 2 слов. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BR_RE = new RegExp([...BRAND_NAMES].sort((a, b) => b.length - a.length).map(esc).join("|"), "gi");
const англФраза = (t: string) => /[A-Za-z][a-z'-]+[\s,]+[A-Za-z][a-z'-]+/.test(t.replace(BR_RE, " "));

function всеKk(): string[] {
  const out: string[] = [];
  for (const v of Object.values(HOME_TEXT)) out.push(v.kk);
  for (const v of Object.values(INVEST_HEAD)) out.push(v.kk);
  for (const c of INVEST_CARDS) out.push(c.title.kk, c.desc.kk, c.sub.kk, ...(typeof c.metric === "string" ? [] : [c.metric.kk]));
  for (const r of Object.values(REGIME_TEXT)) out.push(r.name.kk, r.era.kk);
  out.push(...Object.values(SHORT_LABELS.kk));
  return out;
}

describe("главная: остаток kk — словарём", () => {
  test("знаменатель: строк kk в словарях > 60, имён в списке > 70", () => {
    const n = всеKk().length;
    console.log(`kk-строк ${n}, имён ${BRAND_NAMES.length}, карточек инвест-блока ${INVEST_CARDS.length}`);
    expect(n).toBeGreaterThan(60);
    expect(BRAND_NAMES.length).toBeGreaterThan(70);
    expect(BRAND_NAMES).toContain("Trust Graph");
    expect(BRAND_NAMES).toContain("Shamir's Secret Sharing");
  });

  test("ни одной английской фразы в kk вне списка имён; ни одной пустой строки", () => {
    const плохо = всеKk().filter((t) => !t.trim() || англФраза(t));
    expect(плохо, плохо.join(" | ")).toEqual([]);
  });

  test("КОНТРОЛЬ признака: «Creator economy» ловится, «Trust Graph (деректер)» — нет", () => {
    expect(англФраза("IP лицензиялау + Creator economy ($104B)")).toBe(true);
    expect(англФраза("Trust Graph (деректер)")).toBe(false);
  });

  test("режимы: в словаре ровно те id, что возвращает classify; оси — те же ключи", () => {
    const ids = [...CONST.matchAll(/^\s+id: "([a-z-]+)",$/gm)].map((m) => m[1]).sort();
    expect(ids.length).toBeGreaterThan(8);
    expect(Object.keys(REGIME_TEXT).sort()).toEqual(ids);
    expect(Object.keys(SHORT_LABELS.kk).sort()).toEqual(Object.keys(SLIDER_SHORT_LABELS).sort());
    expect(Object.keys(SHORT_LABELS.en).sort()).toEqual(Object.keys(SLIDER_SHORT_LABELS).sort());
  });

  test("_home.tsx: литералы не вернулись, стек — только вошедшему, виджет получает язык", () => {
    expect(HOME).not.toContain("Какой социальный контракт строит AEVION");
    expect(HOME).not.toContain('label="Отпечаток AEVION"');
    expect(HOME).not.toContain("Creator economy ($104B)");
    expect(HOME).not.toContain(">Other modules<");
    expect(HOME).toContain('...(вошёл ? [{ k: "Stack", v: "Next + Node + PG" }] : [])');
    expect(HOME).toContain("lang={trH ? L : undefined}");
    expect(HOME).toContain("INVEST_CARDS.map((card)");
    // Ряд под каталогом: имена под translate="no" (живой перевод делал из QRight «Registry»).
    expect(HOME).toContain('<span translate="no">QRight</span>');
    expect(HOME).toContain('<span translate="no">QSign</span>');
    // Показатель-слово переводится («5-in-1», «3-layer» были в остатке kk).
    expect(INVEST_CARDS.filter((c) => typeof c.metric === "string" && /[a-z]{3,}/.test(c.metric))).toEqual([]);
  });

  test("виджет kk: без латиницы, под translate=\"no\"", () => {
    const c = render(<ConstitutionEmbed sliders={OA} lang="kk" />).container;
    const текст = c.textContent || "";
    expect(текст).toContain("Ашық тәртіп");
    expect(текст.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
    expect(c.firstElementChild?.getAttribute("translate")).toBe("no");
  });

  test("виджет en: без кириллицы", () => {
    const текст = render(<ConstitutionEmbed sliders={OA} lang="en" />).container.textContent || "";
    expect(текст).toContain("Open Access Order");
    expect(текст.match(/[А-Яа-яЁё]+/g) ?? []).toEqual([]);
  });

  test("КОНТРОЛЬ: виджет без языка — прежние русские подписи и без translate=\"no\"", () => {
    const c = render(<ConstitutionEmbed sliders={OA} />).container;
    expect(c.textContent).toContain("Инновация");
    expect(c.firstElementChild?.getAttribute("translate")).toBeNull();
  });
});
