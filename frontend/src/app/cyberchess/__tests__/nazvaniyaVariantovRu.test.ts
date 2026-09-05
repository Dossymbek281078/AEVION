import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VARIANTS } from "../variants";

/**
 * Экран шахмат русский, а названия вариантов были английскими — и хуже:
 * машинный идентификатор варианта («reinforcement») уезжал прямо в текст
 * «Включить стрим… к варианту дня (reinforcement)».
 *
 * Здесь закреплены ОБА следствия, потому что чинились они по-разному:
 * названия — переводом, идентификатор — тем, что подпись берётся из VARIANTS.
 */

// Слова, которые остаются латиницей намеренно: имена и бренды.
const ИМЕНА = new Set(["Chessy", "CyberChess", "AEVION", "Lichess", "Stockfish"]);

const латинскоеСлово = (s: string) =>
  s.split(/[^A-Za-z]+/).filter((w) => w.length > 1 && !ИМЕНА.has(w));

describe("названия вариантов на русском экране", () => {
  it("ни одно название не состоит из английских слов", () => {
    const плохие = VARIANTS.filter((v) => латинскоеСлово(v.name).length > 0).map(
      (v) => `${v.id}: ${v.name}`,
    );
    expect(плохие).toEqual([]);
    // контроль охвата: вариантов не «пара штук», а весь набор
    expect(VARIANTS.length).toBeGreaterThanOrEqual(13);
  });

  it("у каждого варианта есть непустое название с кириллицей", () => {
    for (const v of VARIANTS) {
      expect(v.name.trim().length, `${v.id}: пустое название`).toBeGreaterThan(0);
      expect(/[А-Яа-яЁё]/.test(v.name), `${v.id}: «${v.name}» без кириллицы`).toBe(true);
    }
  });

  it("подпись «вариант дня» берёт НАЗВАНИЕ, а не идентификатор", () => {
    const код = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const i = код.indexOf("варианту дня (");
    expect(i, "строка «варианту дня (…)» пропала — проверку надо переписать").toBeGreaterThan(0);
    const кусок = код.slice(i, i + 220);
    // именно поиск по VARIANTS отличает название от машинного ключа
    expect(кусок).toContain("VARIANTS.find");
    expect(кусок).toContain("?.name");
  });
});
