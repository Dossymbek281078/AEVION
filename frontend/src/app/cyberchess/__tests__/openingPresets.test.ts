import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { readFileSync } from "node:fs";
import { ECO_PRESETS, defaultRepertoire } from "../openingRepertoireData";
import { OPENING_THEORY } from "../chessCoachEngine";

/* The repertoire builder offers these as starting points. A typo in one move makes
   the whole line unplayable, and nothing would say so — the UI just shows the string.
   Checked here so a bad preset fails a test instead of reaching a player. */

describe("ECO_PRESETS", () => {
  it("has presets to offer", () => {
    expect(ECO_PRESETS.length).toBeGreaterThan(0);
  });

  it("every line replays legally from the start position", () => {
    const broken: string[] = [];
    for (const p of ECO_PRESETS) {
      const c = new Chess();
      for (const san of p.moves) {
        try {
          if (!c.move(san)) { broken.push(`${p.eco} ${p.name}: ${san}`); break; }
        } catch {
          broken.push(`${p.eco} ${p.name}: ${san}`);
          break;
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("uses unique ECO codes so selection cannot be ambiguous", () => {
    const ecos = ECO_PRESETS.map((p) => p.eco);
    expect(new Set(ecos).size).toBe(ecos.length);
  });

  it("declares a colour and at least one move for each", () => {
    for (const p of ECO_PRESETS) {
      expect(["white", "black"]).toContain(p.color);
      expect(p.moves.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  /* Note, deliberately not asserted: most white presets end on a White move, but
     "King's Pawn Game" and "Queen's Pawn Game" are two plies (1.e4 e5 / 1.d4 d5)
     because that is what those openings are named for. The moves are only rendered
     as a caption, so the parity carries no meaning — worth recording so the next
     reader does not mistake it for a bug, as I did. */
  it("writes castling with letters, matching chess.js output", () => {
    for (const p of ECO_PRESETS) {
      for (const san of p.moves) expect(san).not.toMatch(/0-0/);
    }
  });
});

/* Тот же вопрос, но к большому файлу: public/openings.json — 3807 линий, которые
   подставляются в проводник дебютов. Проверка та же: линия должна проигрываться от
   начальной позиции. Одна не проигрывалась — «Ruy Lopez: Morphy 5.O-O» отступал слоном
   ходом f1a4, хотя слон уже стоял на b5; в поле отправления была опечатка, и линия
   обрывалась на пятом ходу. Прогон занимает около двух секунд на 36 803 хода. */
describe("openings.json", () => {
  const openings = JSON.parse(
    readFileSync("public/openings.json", "utf8"),
  ) as Array<{ eco: string; name: string; moves: string }>;

  it("ships a large book", () => {
    expect(openings.length).toBeGreaterThan(3000);
  });

  it("replays every line from the start position", () => {
    const bad: string[] = [];
    for (const o of openings) {
      const moves = String(o.moves || "").trim().split(/\s+/).filter(Boolean);
      if (!moves.length) {
        bad.push(`${o.eco} ${o.name}: пустая линия`);
        continue;
      }
      const c = new Chess();
      for (const u of moves) {
        try {
          if (!c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) throw new Error();
        } catch {
          bad.push(`${o.eco} ${o.name}: ход ${u} невозможен`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
    /* 36803 хода: в одиночку ~2 с, но под полным параллельным прогоном упирается в
       стандартные 20 с. Лимит поднят, а не ослаблена проверка. */
  }, 120_000);
});

/* Стартовый репертуар — то, что человек видит в разделе до того, как заведёт свой.
   Его линии проверялись не больше, чем всё остальное: те же четыре SAN-массива лежали
   в другой структуре и мимо проверки пресетов проходили. */
describe("defaultRepertoire", () => {
  it("replays every seeded line from the start position", () => {
    const bad: string[] = [];
    for (const b of defaultRepertoire()) {
      const c = new Chess();
      for (const san of b.moves) {
        try {
          c.move(san);
        } catch {
          bad.push(`${b.name}: ход ${san} невозможен`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("seeds something to start from", () => {
    expect(defaultRepertoire().length).toBeGreaterThan(0);
  });
});

/* Восемь дебютных линий в движке коуча — третья база ходов в модуле, помимо
   openings.json и пресетов репертуара. Их тоже никто не проигрывал на доске: линия в
   PGN-виде выглядит правдоподобно ровно до момента, когда её пытаешься сыграть. */
describe("OPENING_THEORY", () => {
  it("replays every theory line from the start position", () => {
    const bad: string[] = [];
    for (const t of OPENING_THEORY) {
      const sans = t.moves.replace(/\d+\./g, " ").trim().split(/\s+/).filter(Boolean);
      const c = new Chess();
      for (const san of sans) {
        try {
          c.move(san);
        } catch {
          bad.push(`${t.eco} ${t.name}: ход ${san} невозможен в «${t.moves}»`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps a line for every entry", () => {
    expect(OPENING_THEORY.filter((t) => !t.moves?.trim())).toEqual([]);
  });
});
