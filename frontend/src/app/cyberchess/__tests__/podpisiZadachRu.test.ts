import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { temaZadachiRu, fazaRu } from "../puzzleLabels";

/**
 * Замер 01.09.2026 по банку задач (10 818 штук), увиден глазами на экране
 * «Задачи»: человек видел «Endgame» и «master» вместо «Эндшпиль» и названия
 * приёма.
 *
 *   фаза — по-английски у ВСЕХ:  Middlegame 6767, Endgame 3557, Opening 494
 *   тема — машинный идентификатор у 5079 из 10 818 (47%): advancedPawn,
 *          backRankMate, hangingPiece, kingsideAttack…
 *
 * Сторож считает охват ОТ БАНКА, а не от списка внутри теста: банк вырастет —
 * тест покраснеет сам.
 */

const BANK = () => JSON.parse(readFileSync(join(process.cwd(), "public/puzzles.json"), "utf8")) as
  Array<{ theme?: string; phase?: string }>;
const KOD = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
const KIRILLICA = /[А-Яа-яЁё]/;

describe("подписи задач по-русски", () => {
  const bank = BANK();

  it("банк прочитан", () => {
    // Контроль прибора: пустой банк дал бы зелёный «всё переведено» на любом коде.
    expect(bank.length).toBeGreaterThan(5000);
    expect(bank.some((p) => p.phase === "Endgame")).toBe(true);
  });

  it("каждая фаза из банка переведена", () => {
    const fazy = [...new Set(bank.map((p) => p.phase).filter(Boolean))] as string[];
    expect(fazy.length).toBeGreaterThan(2);
    for (const f of fazy) expect(KIRILLICA.test(fazaRu(f))).toBe(true);
  });

  it("каждая нерусская тема из банка переведена", () => {
    const temy = [...new Set(bank.map((p) => p.theme).filter((t): t is string => !!t && !KIRILLICA.test(t)))];
    expect(temy.length).toBeGreaterThan(20); // контроль: такие темы вообще есть
    const bez = temy.filter((t) => !KIRILLICA.test(temaZadachiRu(t)));
    expect(bez).toEqual([]);
  });

  it("русские темы проходят как есть, незнакомая — тоже", () => {
    expect(temaZadachiRu("Вилка")).toBe("Вилка");
    // Незнакомую метку показываем, а не прячем: она честнее пустоты.
    expect(temaZadachiRu("nesushchestvuyushchaya")).toBe("nesushchestvuyushchaya");
    expect(temaZadachiRu(undefined)).toBe("");
  });

  it("экран показывает переведённое, а не сырое", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(100000);
    expect(s).toContain("[fazaRu(pzCurrent.phase),temaZadachiRu(pzCurrent.theme)]");
    expect(s).not.toContain("[pzCurrent.phase,pzCurrent.theme]");
    expect(s).toContain("{temaZadachiRu(pz.theme)}");
  });
});
