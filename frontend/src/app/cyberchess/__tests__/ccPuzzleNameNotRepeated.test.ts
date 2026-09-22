// Имя банковской задачи «Мат в 2 · Средняя» не повторяет цель, сложность и тему,
// которые карточка и тост печатают своими элементами. Тестер 20.09.2026 видел
// «Мат в 2 · Средняя · Мат в 2 · 1407» в тосте и тройной «Мат в 2» на карточке.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { imyaZadachiBezPovtorov } from "../puzzleLabels";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("имя задачи без повторов", () => {
  it("мат в 2 из банка: цель и сложность выкинуты, остаётся пусто", () => {
    expect(imyaZadachiBezPovtorov({ name: "Мат в 2 · Средняя", goal: "Mate", mateIn: 2, theme: "Мат в 2" })).toEqual([]); // банк отдаёт тему уже по-русски
  });
  it("тема, уже показанная фишкой, не повторяется", () => {
    expect(imyaZadachiBezPovtorov({ name: "Эндшпиль · Средняя", goal: "Best move", theme: "Эндшпиль" })).toEqual([]);
  });
  it("своё имя (PGN, задача дня) остаётся", () => {
    expect(imyaZadachiBezPovtorov({ name: "Задача дня Lichess · abc12", goal: "Best move", theme: "tactics" })).toEqual(["Задача дня Lichess", "abc12"]);
    expect(imyaZadachiBezPovtorov({ name: "Партия (PGN)", goal: "Best move", theme: "custom" })).toEqual(["Партия (PGN)"]);
  });
  it("контроль: незнакомая сложность НЕ вырезается (фильтр по словарю, не по позиции)", () => {
    expect(imyaZadachiBezPovtorov({ name: "Вилка · Адская", goal: "Best move", theme: "fork" })).toEqual(["Адская"]);
  });
  it("тоста «тема · рейтинг» при выборе задачи нет (ложился на фишки 1366 и статистику 1024), шапка карточки идёт через фильтр", () => {
    expect(src).not.toContain('showToast([...imyaZadachiBezPovtorov(pz)');
    expect(src).not.toMatch(/showToast\(\[pz\.name,temaZadachiRu/);
    expect(src).toContain('{imyaZadachiBezPovtorov(pzCurrent).length>0&&<div');
    expect(src).not.toContain('textTransform:"uppercase" as const}}>{pzCurrent.name}</div>');
  });
});
