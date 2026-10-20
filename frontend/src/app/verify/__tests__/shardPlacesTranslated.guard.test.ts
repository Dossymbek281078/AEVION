/**
 * Названия и держатели долей на /verify/<cert> переведены — по точной строке из API.
 *
 * ПОВОД (20.10.2026, очередь Оркестратора). После правды об осколках бейдж
 * «✓ ДОЛЯ АВТОРА ВНЕ AEVION» стал русским, а карточки под ним остались
 * «Доля 1: Author Vault», «Доля 3: Public Witness», «our DB» — строки приходят
 * из pipeline.ts (shardDistribution.locations), разметка их печатала как есть.
 * Ключ словаря — ровно строка бэка: переименуют её там — сторож покраснеет здесь,
 * а не посетитель увидит английский.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFY_DICT, tv } from "../[id]/verifyI18n";

const PIPELINE = readFileSync(
  join(__dirname, "../../../../../aevion-globus-backend/src/routes/pipeline.ts"),
  "utf8",
);
const PAGE = readFileSync(join(__dirname, "../[id]/page.tsx"), "utf8");

/** Строки place/held из массивов locations в pipeline.ts. */
function shardStrings(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\{\s*index:\s*\d,\s*place:\s*"([^"]+)",\s*held:\s*"([^"]+)"/g)) {
    out.add(m[1]);
    out.add(m[2]);
  }
  return [...out];
}

describe("/verify: доли называются на языке посетителя", () => {
  const strings = shardStrings(PIPELINE);

  it("КОНТРОЛЬ: прибор находит строки долей в pipeline.ts (знаменатель)", () => {
    expect(strings).toContain("Author Vault");
    expect(strings).toContain("Public Witness");
    expect(strings).toContain("our DB");
    expect(strings.length).toBeGreaterThanOrEqual(8);
  });

  it("у каждой строки доли есть ru и kk, не равные английскому", () => {
    const missing: string[] = [];
    for (const s of strings) {
      for (const lang of ["ru", "kk"] as const) {
        const v = VERIFY_DICT[lang]?.[s];
        if (!v || v === s) missing.push(`${lang}: ${s}`);
      }
    }
    expect(missing, `строк долей ${strings.length}`).toEqual([]);
  });

  it("разметка пропускает place и held через словарь", () => {
    expect(PAGE).toContain("{tv(lang, loc.place)}");
    expect(PAGE).toContain("{tv(lang, loc.held)}");
    expect(PAGE).not.toMatch(/\{loc\.place\}|\{loc\.held\}/);
  });

  it("английский посетитель видит исходную строку", () => {
    expect(tv("en", "Author Vault")).toBe("Author Vault");
    expect(tv("ru", "Public Witness")).toBe("Публичный свидетель");
  });
});
