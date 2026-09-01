import { describe, it, expect } from "vitest";
import { CHESS_SOUND_PRESETS } from "../chessSounds";
import { PIECE_SETS } from "../Pieces";

/**
 * Панель настроек — экран, который открывает почти каждый игрок, и именно
 * там жило больше всего английских слов: «toast-звуки», «underpromotions»,
 * «top-3 metrics», «Classic vector (default)», «низкие синтетические pulse».
 *
 * Ни один тест этого не видел: страница работает одинаково на любом языке.
 * Здесь закреплено следствие — подписи, которые ЧИТАЕТ человек, русские.
 */

// Латиницей остаются намеренно: бренды, форматы и общепринятые обозначения.
const РАЗРЕШЕНО = new Set([
  "AEVION", "CyberChess", "Chessy", "Lichess", "Stockfish", "NNUE", "CPI",
  "Klimt", "Cburnett", "chess", "com", "FM", "PD", "Neon", "Minimal", "Bold", "Chess",
]);

function английские(текст: string): string[] {
  // дефис на конце («FM-щелчок») давал слово «FM-», и список разрешённых его не узнавал
  return (текст.match(/[A-Za-z][A-Za-z'-]*/g) || [])
    .map((w) => w.replace(/^[-']+|[-']+$/g, ""))
    .filter((w) => w.length > 1 && !РАЗРЕШЕНО.has(w));
}

describe("настройки говорят по-русски", () => {
  it("у звуковых наборов русские названия", () => {
    const плохие = CHESS_SOUND_PRESETS
      .filter((p) => !/[А-Яа-яЁё0-9]/.test(p.name) || английские(p.name).length > 0)
      .map((p) => `${p.id}: ${p.name}`);
    expect(плохие).toEqual([]);
    // знаменатель: наборов десятки, а не пара — иначе список ничего не охватывает
    expect(CHESS_SOUND_PRESETS.length).toBeGreaterThanOrEqual(50);
  });

  it("в описаниях звуков нет английских слов", () => {
    const плохие = CHESS_SOUND_PRESETS
      .map((p) => ({ id: p.id, слова: английские(p.desc || "") }))
      .filter((x) => x.слова.length > 0)
      .map((x) => `${x.id}: ${x.слова.join(",")}`);
    expect(плохие).toEqual([]);
  });

  it("подсказки к наборам фигур русские", () => {
    const плохие = PIECE_SETS
      .filter((s) => английские(s.hint).length > 0 || !/[А-Яа-яЁё]/.test(s.hint))
      .map((s) => `${s.id}: ${s.hint}`);
    expect(плохие).toEqual([]);
    expect(PIECE_SETS.length).toBeGreaterThanOrEqual(4);
  });
});
