import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as Labels from "../puzzleLabels";
import * as Norm from "../puzzleNormalize";
import * as Zt from "../zadachiText";

/**
 * Вкладка «Задачи» на английской странице (замер на проде 30.10.2026, /en/cyberchess, 390 px):
 * «Продвинутая пешка», «Фa4+», «Подсказка — лучший ход:», «Решено».
 * Тексты en/kk живут в zadachiText.ts и грузятся динамическим import (храповик объёма page.tsx),
 * ru остаётся байт в байт.
 */
const KIR = /[\u0400-\u04FF]/;
const FEN = "4k3/8/8/8/8/8/8/Q3K3 w - - 0 1"; // Qa1-a4 даёт шах по диагонали a4-e8
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("page.tsx: zadachiText только динамически", () => {
  it("статического импорта нет, динамический есть", () => {
    expect(/^import [^;]*?from "\.\/zadachiText";/m.test(PAGE)).toBe(false);
    expect(PAGE).toContain('import("./zadachiText")');
  });
  it("ошибка загрузки не глотается молча", () => {
    const i = PAGE.indexOf('import("./zadachiText")');
    expect(PAGE.slice(i, i + 300)).toContain("console.error");
  });
  it("прежние ключи pzt.* из словаря не используются", () => {
    expect(PAGE.includes('cc.t("pzt.')).toBe(false);
  });
});

describe("каждый pt(\"…\") имеет перевод", () => {
  const used = [...new Set([...PAGE.matchAll(/\bpt\(("(?:[^"\\n]|\.)*")\)/g)].map((m) => JSON.parse(m[1]) as string))];
  it("прибор видит вызовы pt", () => expect(used.length).toBeGreaterThanOrEqual(40));
  it("ключ есть, en без кириллицы, kk не пустой", () => {
    for (const k of used) {
      const v = Zt.ZADACHI_TEXT[k];
      expect(v, k).toBeTruthy();
      expect(KIR.test(v.en), `${k} en: ${v.en}`).toBe(false);
      expect(v.kk.length, k).toBeGreaterThan(0);
    }
  });
  it("в ZADACHI_TEXT нет лишних ключей", () => {
    for (const k of Object.keys(Zt.ZADACHI_TEXT)) expect(used.includes(k), k).toBe(true);
  });
});

describe("тема и фаза по языку", () => {
  const SAMPLE = ["advancedPawn", "mateIn1", "backRankMate", "Мат в 1", "неизвестная", "kingsideAttack", "mate", "hangingPiece", "master", ""];
  it("ru — прежний текст байт в байт", () => {
    for (const t of SAMPLE) expect(Zt.temaNaYazyke(t, "ru")).toBe(Labels.temaZadachiRu(t));
    for (const f of ["Opening", "Middlegame", "Endgame", "x", ""]) expect(Zt.fazaNaYazyke(f, "ru")).toBe(Labels.fazaRu(f));
  });
  it("en — английские слова без кириллицы", () => {
    expect(Zt.temaNaYazyke("advancedPawn", "en")).toBe("Advanced pawn");
    expect(Zt.temaNaYazyke("backRankMate", "en")).toBe("Back rank mate");
    expect(Zt.temaNaYazyke("mateIn1", "en")).toBe("Mate in 1");
    expect(Zt.temaNaYazyke("Продвинутая пешка", "en")).toBe("Advanced pawn");
    expect(Zt.fazaNaYazyke("Endgame", "en")).toBe("Endgame");
    for (const t of ["advancedPawn", "mateIn1", "attraction", "deflection", "discoveredAttack", "bishopEndgame", "kingsideAttack",
      "Мат в 1", "Вилка", "Расчистка", "Открытый король", "Слоновый эндшпиль", "Дебютная ловушка", "Атака на королевском"]) {
      expect(KIR.test(Zt.temaNaYazyke(t, "en")), t).toBe(false);
    }
  });
});

describe("запись хода по языку", () => {
  it("ru — прежний hodPoRusski, en — английская SAN", () => {
    expect(Norm.hodPoRusski(FEN, "a1a4")).toBe("Фa4+");
    expect(Zt.hodNaYazyke(FEN, "a1a4", "ru")).toBe(Norm.hodPoRusski(FEN, "a1a4"));
    expect(Zt.hodNaYazyke(FEN, "a1a4", "en")).toBe("Qa4+");
    expect(Zt.hodNaYazyke(FEN, "a1a4", "kk")).toBe("Qa4+");
    expect(Zt.hodNaYazyke(FEN, "zz", "en")).toBe("zz");
  });
});

describe("page.tsx: голых русских литералов вкладки нет", () => {
  it("переведённые строки только через pt", () => {
    for (const s of [">Заново<", ">Решение<", ">В фильтре<", ">Лучший результат<", ">Рекорд серии<", "Нет задач по фильтру</div>"]) {
      expect(PAGE.includes(s), s).toBe(false);
    }
  });
});
