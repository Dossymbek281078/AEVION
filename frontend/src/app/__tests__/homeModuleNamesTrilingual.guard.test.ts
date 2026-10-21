// 🔴 21.10.2026 (окно Приложения): на kk-главной каталог модулей шёл английским и русским —
// живой переводчик возвращал «HEALTHAI: HealthAI — Personal AI Doctor» эхом. Названия теперь
// в словаре data/moduleNames.ts по id проекта. Сторож держит: каждый id каталога бэка есть
// в словаре на ru/en/kk, бренд — из одного списка brandNames.json, а служебные подписи
// (Demo pipeline, runtime) на главной показываются только вошедшему.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MODULE_NAMES, HOME_CARDS, BRAND_NAMES, moduleTitle } from "@/data/moduleNames";

const PROJECTS = path.resolve(process.cwd(), "..", "aevion-globus-backend", "src", "data", "projects.ts");
const HOME = path.resolve(process.cwd(), "src", "app", "_home.tsx");
const KK = /[ӘәҒғҚқҢңӨөҰұҮүІіҺһ]/;

function idsКаталога(): string[] {
  return [...fs.readFileSync(PROJECTS, "utf8").matchAll(/^\s{4}id: "([^"]+)"/gm)].map((m) => m[1]);
}

describe("главная: названия модулей на трёх языках из словаря", () => {
  const ids = idsКаталога();
  test("знаменатель: id в каталоге бэка > 40, брендов в списке > 30", () => {
    console.log(`id каталога ${ids.length}, записей словаря ${Object.keys(MODULE_NAMES).length}, брендов ${BRAND_NAMES.length}`);
    expect(ids.length).toBeGreaterThan(40);
    expect(BRAND_NAMES.length).toBeGreaterThan(30);
  });
  test("каждый id каталога есть в словаре, описание непустое на ru/en/kk", () => {
    const нет = ids.filter((id) => !MODULE_NAMES[id]);
    const пусто = ids.filter((id) => MODULE_NAMES[id]?.sub && !(["en", "ru", "kk"] as const).every((l) => MODULE_NAMES[id].sub![l].trim()));
    expect(нет, `нет в словаре: ${нет.join(", ")}`).toEqual([]);
    expect(пусто, `пустое описание: ${пусто.join(", ")}`).toEqual([]);
  });
  test("бренд каждой записи — из brandNames.json", () => {
    const чужие = Object.entries(MODULE_NAMES).filter(([, m]) => !BRAND_NAMES.includes(m.brand)).map(([id, m]) => `${id}:${m.brand}`);
    expect(чужие, чужие.join(", ")).toEqual([]);
  });
  test("kk-описания по-казахски, а не копия en/ru", () => {
    const плохо: string[] = [];
    for (const [id, m] of Object.entries(MODULE_NAMES)) if (m.sub && (m.sub.kk === m.sub.en || m.sub.kk === m.sub.ru || !KK.test(m.sub.kk))) плохо.push(id);
    for (const c of HOME_CARDS) if (c.d.kk === c.d.en || c.d.kk === c.d.ru || !KK.test(c.d.kk)) плохо.push("карточка " + c.id);
    expect(плохо, плохо.join(", ")).toEqual([]);
  });
  test("КОНТРОЛЬ: moduleTitle даёт язык посетителя, неизвестный id — запасное имя", () => {
    expect(moduleTitle("healthai", "kk", "x")).toBe("HealthAI — Жеке ЖИ-дәрігер");
    expect(moduleTitle("healthai", "de", "x")).toBe("HealthAI — Personal AI Doctor");
    expect(moduleTitle("нет-такого", "kk", "Запасное")).toBe("Запасное");
  });
  test("_home.tsx: имя модуля из словаря, служебные подписи только вошедшему", () => {
    const s = fs.readFileSync(HOME, "utf8");
    expect(s).toContain("moduleTitle(p.id, lang, p.name)");
    expect(s).not.toMatch(/\{p\.code\}: \{p\.name\}/);
    const demo = s.indexOf("Demo pipeline — Wave 1");
    expect(s.slice(demo - 700, demo)).toContain("{вошёл ? (");
    const hint = s.indexOf("{p.runtime?.hint ?");
    expect(s.slice(hint - 300, hint)).toContain("{вошёл ? (");
  });
});
