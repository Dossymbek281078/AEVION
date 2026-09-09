import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 09.09.2026. ПОЛНОЕ восстановление вариантов при resume (было: гард, который
 * просто не автосейвил вариантные партии — см. прежний ccVariantNoWrongResume).
 *
 * ResumeSnap v2 хранит вариант-состояние, живущее ВНЕ fen: variant, стартовый
 * fen, армии, счётчики Three-Check, пул Power Drop, кубик Diceblade. resumeGame
 * их восстанавливает И гасит ref-guard'ы вариант-эффектов на новый bk — иначе
 * эффекты пересчитают ПОСЛЕДНИЙ ход поверх восстановленного (двойной шах,
 * повторное взятие в пул). Разбор: project_cyberchess_variant_resume_scope.
 *
 * Сторож держит контракт. Мутации (снять гашение рефов / вернуть гард
 * variant!=="standard" / убрать поля из snap) → красный.
 */
const SRC = path.join(__dirname, "..", "page.tsx");
const src = () => fs.readFileSync(SRC, "utf-8");

describe("вариантные партии восстанавливаются при resume (v2)", () => {
  it("автосейв БОЛЬШЕ НЕ ограничен standard (гард снят)", () => {
    const s = src();
    // прежний гард выхода не должен содержать variant!=="standard"
    const guard = s.match(/if\(tab!=="play"\|\|!on\|\|over\|\|setup\|\|hist\.length===0[^)]*\)return/);
    expect(guard, "автосейв-гард не найден — проверку обновить").not.toBeNull();
    expect(guard![0].includes('variant!=="standard"')).toBe(false);
  });

  it("ResumeSnap v2 объявляет вариант-поля", () => {
    const s = src();
    const m = s.match(/type ResumeSnap=\{[\s\S]*?\};/);
    expect(m, "тип ResumeSnap не найден").not.toBeNull();
    const t = m![0];
    for (const f of ["variant?", "checksByWhite?", "checksByBlack?", "dropPool?", "diceFace?", "variantArmies?", "variantStartFen?"]) {
      expect(t.includes(f), `в ResumeSnap нет поля ${f}`).toBe(true);
    }
    expect(/v:1\|2/.test(t), "версия snap не поднята до 1|2").toBe(true);
  });

  it("snap записывает вариант-состояние", () => {
    const s = src();
    const m = s.match(/const snap:ResumeSnap=\{v:2,[^}]*\}/);
    expect(m, "snap v2 не найден").not.toBeNull();
    for (const f of ["variant", "variantStartFen", "variantArmies", "diceFace", "dicePieceType", "diceLabel", "checksByWhite", "checksByBlack", "dropPool"]) {
      expect(m![0].includes(f), `snap не пишет ${f}`).toBe(true);
    }
  });

  it("resumeGame восстанавливает вариант-состояние", () => {
    const s = src();
    for (const call of ["sVariant(s.variant", "sChecksByWhite(s.checksByWhite", "sChecksByBlack(s.checksByBlack", "sDropPool(s.dropPool", "sDiceFace(s.diceFace", "sVariantArmies(s.variantArmies"]) {
      expect(s.includes(call), `resumeGame не восстанавливает: ${call}`).toBe(true);
    }
  });

  it("resumeGame ГАСИТ ref-guard'ы вариант-эффектов на новый bk (иначе двойной пересчёт)", () => {
    const s = src();
    // в функциональном апдейтере sBk рефы выставляются на nb
    const upd = s.match(/sBk\(k=>\{const nb=k\+1;[^}]*\}\)/);
    expect(upd, "гашение рефов в апдейтере sBk не найдено").not.toBeNull();
    for (const ref of ["lastCheckBkRef.current=nb", "lastAtomicBkRef.current=nb", "lastCaptureBkRef.current=nb", "reinfLastMoveRef.current=s.hist.length"]) {
      expect(upd![0].includes(ref), `не погашен: ${ref}`).toBe(true);
    }
  });
});
