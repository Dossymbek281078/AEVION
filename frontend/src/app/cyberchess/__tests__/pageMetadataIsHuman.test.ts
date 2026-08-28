import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Заголовок вкладки и описание для поисковой выдачи — тоже речь продукта,
 * и вдобавок единственная её часть, которую человек читает ДО того, как
 * зайдёт. Ни один прежний сторож их не видел: метаданные не входят ни в
 * текст между тегами, ни в подписи пунктов.
 *
 * 28.08.2026 после того, как слово «пазл» было убрано со всех экранов,
 * оно осталось ровно в одном месте — в заголовке вкладки. А описание для
 * Google звучало так: «AI-коуч Алексей, Blunder Rewind, Puzzle Rush с
 * time-bonus, Game DNA».
 */
const ROOT = path.join(__dirname, "..");

/** Внутренние слова и калька, которым не место в выдаче поисковика. */
const ZHARGON = /(Blunder Rewind|time-bonus|Game DNA|Puzzle Rush|пазл|стрик|буст|fallback|endpoint)/i;

function fajlyMetadata(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") fajlyMetadata(p, acc);
    } else if (e.name === "layout.tsx" || e.name === "page.tsx") acc.push(p);
  }
  return acc;
}

/** title и description из блока metadata — то, что уходит во вкладку и в выдачу. */
function metaStroki(src: string): string[] {
  const out: string[] = [];
  // Ищем по всему файлу, а не внутри блока metadata: попытка вырезать блок
  // регуляркой дала зелёный тест, который НЕ читал настоящий файл — мутация
  // его и разоблачила. Лишние совпадения (title внутри appleWebApp) безвредны:
  // это тоже текст, который видит человек.
  if (!src.includes("export const metadata")) return out;
  for (const m of src.matchAll(/(title|description):\s*\n?\s*"([^"]{4,400})"/g)) out.push(m[2]);
  return out;
}

describe("заголовок вкладки и описание для поиска — на языке человека", () => {
  it("в метаданных модуля нет внутренних слов", () => {
    const plohie: string[] = [];
    for (const f of fajlyMetadata(ROOT)) {
      for (const t of metaStroki(fs.readFileSync(f, "utf8"))) {
        if (ZHARGON.test(t)) plohie.push(`${path.relative(ROOT, f)}: ${t.slice(0, 70)}`);
      }
    }
    expect(plohie).toEqual([]);
  });

  it("проверка умеет краснеть и действительно читает метаданные", () => {
    const fake = 'export const metadata: Metadata = {\n  title: "CyberChess — AI-тренер и пазлы",\n};';
    const najdeno = metaStroki(fake);
    expect(najdeno.length, "строки метаданных должны находиться").toBe(1);
    expect(najdeno.filter((t) => ZHARGON.test(t)).length).toBe(1);
  });
});
