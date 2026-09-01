import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Подпись пункта, в которой нет ни одной русской буквы, — это непереведённое
 * место, а не решение. 28.08.2026 в модуле их было двенадцать: «Opening
 * Trainer», «Position Editor», «Game DNA», «Insights», «Multi-Panel split»,
 * «Streamer Mode toggle», «Eval bar + Opening Explorer», «OBS-ready dark UI»,
 * «Chess Personality», «Lichess Daily Puzzle» — и «Bullet» при том, что на
 * соседнем экране тот же режим называется «Пуля».
 *
 * Исключения — только собственные имена: движок, сервис, название режима.
 */
const ROOT = path.join(__dirname, "..");

// Собственные имена и шахматные форматы: их не переводят ни на одном сайте.
// Форматы добавлены заранее — сейчас все подписи с ними содержат русские
// слова и под правило не попадают, но короткое label:"FEN" дало бы ложную
// красноту, а к вечно краснеющему сторожу перестают присматриваться.
const ИМЕНА = ["Puzzle Rush", "Stockfish", "Lichess", "Chessy", "AEVION", "CyberChess",
  "PGN", "FEN", "ELO", "UCI", "SAN"];

function stranicy(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") stranicy(p, acc);
    } else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const POZICII = /(label:|title:|hint:|sub:|desc:)"([A-Za-z0-9 ,.·:()+—–-]{6,60})"/g;

describe("подписи на экране — по-русски", () => {
  it("нет подписи без единой русской буквы", () => {
    const plohie: string[] = [];
    for (const f of stranicy(ROOT)) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(POZICII)) {
        const txt = m[2];
        if (ИМЕНА.some((n) => txt.includes(n))) continue;
        plohie.push(`${path.basename(f)}: ${txt}`);
      }
    }
    expect(plohie).toEqual([]);
  });

  it("проверка умеет краснеть", () => {
    const fake = 'label:"Opening Trainer"';
    const najdeno = [...fake.matchAll(POZICII)].filter(
      (m) => !ИМЕНА.some((n) => m[2].includes(n)),
    );
    expect(najdeno.length).toBe(1);
  });

  it("собственное имя не считается нарушением", () => {
    const ok = 'label:"Puzzle Rush"';
    const najdeno = [...ok.matchAll(POZICII)].filter(
      (m) => !ИМЕНА.some((n) => m[2].includes(n)),
    );
    expect(najdeno).toEqual([]);
  });
});
