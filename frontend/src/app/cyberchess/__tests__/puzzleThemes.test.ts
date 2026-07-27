import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { themeLabel, THEME_RU_KEYS, puzzleTitle, difficultyLabel } from "../puzzleThemes";

describe("themeLabel", () => {
  it("translates the raw Lichess ids that used to leak into the UI", () => {
    expect(themeLabel("kingsideAttack")).toBe("Атака на королевском фланге");
    expect(themeLabel("advancedPawn")).toBe("Продвинутая пешка");
    expect(themeLabel("crushing")).toBe("Разгром");
    expect(themeLabel("hangingPiece")).toBe("Висящая фигура");
  });

  it("passes Russian themes through — the corpus already has them", () => {
    expect(themeLabel("Вилка")).toBe("Вилка");
    expect(themeLabel("Мат в 2")).toBe("Мат в 2");
  });

  it("passes an unknown id through rather than swallowing it", () => {
    expect(themeLabel("someBrandNewTheme")).toBe("someBrandNewTheme");
  });

  it("handles empty input", () => {
    expect(themeLabel("")).toBe("");
    expect(themeLabel(undefined)).toBe("");
    expect(themeLabel(null)).toBe("");
  });

  it("never returns a camelCase or ascii-only label for a mapped id", () => {
    for (const key of THEME_RU_KEYS) {
      const label = themeLabel(key);
      expect(label).not.toBe(key);
      expect(/[А-Яа-я]/.test(label)).toBe(true);
    }
  });

  /* The point of the map: no theme in the shipped corpus should reach the player
     as a raw identifier. Reads the real data file, so a corpus refresh that adds
     new Lichess themes fails here instead of surfacing them in the UI. */
  it("covers every latin-script theme AND phase present in public/puzzles.json", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{ theme?: string; phase?: string }>;
    const themes = new Set<string>();
    // Both fields render through themeLabel — the puzzle header maps over
    // [phase, theme] — so a raw phase leaks to the player just like a raw theme.
    for (const p of puzzles) {
      if (p.theme) themes.add(p.theme);
      if (p.phase) themes.add(p.phase);
    }

    const untranslated = [...themes].filter((t) => {
      const label = themeLabel(t);
      // A label is fine if it carries Cyrillic; a bare latin label is a leak.
      return !/[А-Яа-я]/.test(label);
    });

    expect(untranslated).toEqual([]);
  });

  /* Половина корпуса пришла из дампа Lichess с темой "fork", вторая половина несёт
     русскую "Вилка" — для кода это ДВЕ разные темы. В списке фильтра они стояли двумя
     пунктами, и выбор одного прятал задачи другого: «Завлечение» показывало 20 задач,
     пока 261 лежала под "attraction". Поэтому тема приводится к метке на входе, в
     месте загрузки puzzles.json. Тест держит сам факт синонимов: пока в корпусе есть
     пары, сводящиеся к одной метке, нормализация обязана оставаться. */
  it("has synonym themes in the corpus that must collapse to one label", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{ theme?: string }>;
    const byLabel = new Map<string, Set<string>>();
    for (const p of puzzles) {
      if (!p.theme) continue;
      const label = themeLabel(p.theme);
      if (!byLabel.has(label)) byLabel.set(label, new Set());
      byLabel.get(label)!.add(p.theme);
    }
    const split = [...byLabel.entries()].filter(([, raws]) => raws.size > 1);
    expect(split.length).toBeGreaterThan(0);
    // «Вилка» и "fork" — самая наглядная пара, она обязана сводиться
    expect(themeLabel("fork")).toBe("Вилка");
  });
});

describe("puzzleTitle", () => {
  it("keeps a human name as-is", () => {
    expect(puzzleTitle({ name: "Вилка · Средняя", theme: "Вилка", r: 900 })).toBe("Вилка · Средняя");
  });

  it("replaces a raw Lichess id with theme and difficulty", () => {
    expect(puzzleTitle({ name: "L001om", theme: "Вилка", r: 900 })).toBe("Вилка · Средняя");
    expect(puzzleTitle({ name: "L002HE", theme: "kingsideAttack", r: 1500 }))
      .toBe("Атака на королевском фланге · Сложная");
  });

  it("falls back to a generic label when the theme is missing too", () => {
    expect(puzzleTitle({ name: "L001om", r: 500 })).toBe("Тактика · Лёгкая");
  });

  it("uses the same difficulty bands as the badge in the UI", () => {
    expect(difficultyLabel(799)).toBe("Лёгкая");
    expect(difficultyLabel(800)).toBe("Средняя");
    expect(difficultyLabel(1399)).toBe("Средняя");
    expect(difficultyLabel(1400)).toBe("Сложная");
    expect(difficultyLabel(1999)).toBe("Сложная");
    expect(difficultyLabel(2000)).toBe("Эксперт");
  });

  /* Almost half the shipped corpus carried a raw id as its name — the player was
     told "✓ Решено! L001om". Nothing should reach them like that. */
  it("leaves no raw id reaching the player across the whole corpus", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{ name?: string; theme?: string; r?: number }>;
    const leaks = puzzles.filter((p) => /^[A-Za-z0-9]{4,8}$/.test(puzzleTitle(p)));
    expect(leaks).toEqual([]);
  });
});


/* Формат Lichess: FEN — позиция ДО хода соперника, решение начинается с этого хода.
   После верного сдвига игрок ходит первым и последним, значит полуходов НЕЧЁТНОЕ число.
   Чётная длина = сдвиг не сделан, и игроку показывают позицию на полуход раньше, ожидая
   от него ход соперника. Замер боевого пула 2026-07-27: все 20 000 задач были чётными,
   и во всех 6370 матовых мат ставил соперник, а не игрок. Запасной корпус собран верным
   импортёром — здесь это и закрепляется. */
describe("puzzles.json corpus", () => {
  it("gives the player the first and the last move of every solution", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{ sol: string[] }>;
    const even = puzzles.filter((p) => Array.isArray(p.sol) && p.sol.length % 2 === 0);
    expect(even).toHaveLength(0);
  });

  /* «Мат в N» — это N ходов ИГРОКА, то есть 2N-1 полуходов. Три задачи обещали мат в
     пять, а вели к мату в шесть: подпись, тема и счётчик расходились с самим решением.
     Игрок в таких считает не ту глубину и бросает верную идею как «слишком длинную». */
  it("promises exactly the number of moves its solution takes", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{
      name?: string;
      goal?: string;
      mateIn?: number;
      sol: string[];
    }>;
    const wrong = puzzles
      .filter((p) => p.goal === "Mate" && p.mateIn)
      .filter((p) => Math.ceil(p.sol.length / 2) !== p.mateIn)
      .map((p) => `${p.name}: mateIn=${p.mateIn}, а ходов игрока ${Math.ceil(p.sol.length / 2)}`);
    expect(wrong).toEqual([]);
  });
});
