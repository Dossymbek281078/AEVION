import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zadanieNadDoskoy, imyaPoResheniyu } from "../puzzleNormalize";
import { strokaTsennosti } from "../panelResheno";
import { tFor } from "../i18n";

/*
 * 🔴 Первый экран задачи (вход из Shorts по ?puzzle=) говорит на языке гостя.
 *
 * Повод 13.10.2026: свежий контекст en-US на /cyberchess?puzzle=li_1TpvR — меню
 * английское, а условие «Ход чёрных · Мат в 1», тост «Задача по ссылке», шапка
 * «задачи в банке», панель «Решено!» и «Следующая задача» — жёсткий русский
 * (531 знак кириллицы в кадре). Английские Shorts Ави выходят 16–17.10.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
// мат в 1: белые ставят мат ферзём; сторона хода — белые
const МАТ_В_1 = { fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", sol: ["e1e8"] };

describe("первый экран задачи — на языке гостя", () => {
  it("🔴 условие над доской по-английски и по-казахски, русское — как было", () => {
    expect(zadanieNadDoskoy(МАТ_В_1, "en")).toBe("White to move · Mate in 1");
    expect(zadanieNadDoskoy(МАТ_В_1, "kk")).toBe("Ақтар жүреді · 1 жүрісте мат");
    expect(zadanieNadDoskoy(МАТ_В_1)).toBe("Ход белых · Мат в 1");
    expect(imyaPoResheniyu(МАТ_В_1, "en")).toBe("Mate in 1");
  });

  it("строка ценности панели «Решено!» по языку", () => {
    expect(strokaTsennosti(502584, "en")).toBe("502,584 more puzzles and an AI coach");
    expect(strokaTsennosti(null, "en")).toBe("More puzzles and an AI coach");
    expect(strokaTsennosti(502584)).toMatch(/^Ещё 502.584 задач и ИИ-тренер$/);
  });

  it("ключи pz.* есть во всех трёх языках, английские — без кириллицы", () => {
    const ключи = ["pz.link.opened", "pz.link.failed", "pz.solved", "pz.next", "pz.noMoves", "pz.noMoves.puzzles", "pz.mode.learn", "pz.mode.custom", "pz.askCoach", "pz.threatMap", "pz.aloud", "pz.flip", "pz.newGame", "pz.bank", "pz.mateIn", "pz.bestMove"];
    for (const k of ключи) {
      for (const loc of ["ru", "en", "kk"] as const) expect(tFor(loc, k), `${loc}:${k}`).not.toBe(k);
      expect(/[а-яА-ЯёЁ]/.test(tFor("en", k)), `en:${k} без кириллицы`).toBe(false);
    }
    expect(ключи.length).toBeGreaterThanOrEqual(15);
  });

  it("страница зовёт словарь, а не литералы: 18 мест", () => {
    expect(СТРАНИЦА.split('cc.t("pz.').length - 1).toBeGreaterThanOrEqual(18);
    for (const лит of ["showToast(`🔗 Задача по ссылке", ">✓ Решено! {pzCurrent.name}", ">Следующая задача →<", ">Пока нет ходов<", ">🎓 Спросить тренера<", ">Перевернуть</Btn>", '"Обучение"]']) {
      expect(СТРАНИЦА, лит).not.toContain(лит);
    }
    expect(СТРАНИЦА).toContain("zadanieNadDoskoy(pzCurrent,cc.locale)");
  });
});
