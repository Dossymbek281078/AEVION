/**
 * Помощник AEVION говорит на языке посетителя — на всех страницах.
 *
 * ПОВОД (20.10.2026, замер /devhub в ru-RU/en-US/kk-KZ): виджет стоит на каждой
 * странице и смешивал языки при любом выборе — кнопка «AI Agent», «Send»,
 * «Working…», подсказки и поле по-английски, aria-label по-русски.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(__dirname, "../AgentDock.tsx"), "utf8");

/** Текстовые узлы JSX и строковые атрибуты, где есть буквы (не выражения). */
function зашитыеСтроки(src: string): string[] {
  const out: string[] = [];
  const код = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const m of код.matchAll(/(?:aria-label|title|placeholder)="([^"]*[A-Za-zА-Яа-я][^"]*)"/g)) out.push(m[1]);
  for (const m of код.matchAll(/>([^<>{}]*[A-Za-zА-Яа-я]{2,}[^<>{}]*)</g)) {
    const t = m[1].trim();
    if (t && !/[=;()]/.test(t)) out.push(t);
  }
  return out;
}

describe("AgentDock: язык посетителя", () => {
  it("КОНТРОЛЬ: детектор видит зашитую строку", () => {
    expect(зашитыеСтроки('<span className="x">AI Agent</span><b aria-label="Send">{D.send}</b>')).toEqual(["Send", "AI Agent"]);
  });

  it("в разметке нет зашитых подписей — всё через словарь DOCK", () => {
    // ToolChips title="Native"/"MCP" — названия классов инструментов, не перевод
    const зашито = зашитыеСтроки(SRC).filter((t) => !["Native", "MCP"].includes(t));
    expect(зашито).toEqual([]);
  });

  it("язык берётся из useI18nOptional, а словарь есть на ru/en/kk с одинаковыми ключами", () => {
    expect(SRC).toContain("useI18nOptional()?.lang");
    const блок = (lang: string) => {
      const i = SRC.indexOf(`  ${lang}: {`, SRC.indexOf("const DOCK = {"));
      return SRC.slice(i, SRC.indexOf("\n  },", i));
    };
    const ключи = (b: string) => [...b.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
    expect(ключи(блок("ru")).length).toBeGreaterThanOrEqual(12);
    expect(ключи(блок("en"))).toEqual(ключи(блок("ru")));
    expect(ключи(блок("kk"))).toEqual(ключи(блок("ru")));
    expect(блок("ru")).toContain("ИИ-помощник");
    expect(блок("kk")).toContain("ЖИ-көмекші");
  });
});

describe("подзаголовок инструментов — из словаря", () => {
  // 23.10.2026, кадр прода 390 при ru: под «Помощник AEVION» стояло
  // «image · voice · music · pay · email · SMS · translate» — литерал в JSX.
  it("в разметке нет английского перечня, есть D.caps / D.capsCode", () => {
    expect(SRC).not.toMatch(/\{projectId \? "code · image/);
    expect(SRC).toContain("{projectId ? D.capsCode : D.caps}");
  });
  it("у каждого языка свой перечень, ru и kk — без английских слов", () => {
    const caps = [...SRC.matchAll(/^\s{4}caps: "([^"]+)",$/gm)].map((m) => m[1]);
    expect(caps.length, "знаменатель: caps в трёх языках").toBe(3);
    const нелатинские = caps.filter((c) => !/\b(image|voice|music|translate)\b/.test(c));
    expect(нелатинские.length, "ru и kk переведены").toBe(2);
  });
});
