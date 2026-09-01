import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Партия кладётся в историю В МОМЕНТ конца, а разбор считается через 800 мс
 * ПОСЛЕ. Значит поле analysis уходило в хранилище пустым ВСЕГДА — при том
 * что рядом в коде обещано «per-move cp-loss analysis for richer FIDE
 * calibration». Обещание было, данных не было.
 *
 * Проверяем не «функция существует», а связку: id запоминается при
 * сохранении и используется при досохранении. Без id разбор лёг бы на
 * первую партию в списке — а ею может оказаться следующая, уже начатая.
 */
const KOD = bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));

describe("разбор доезжает до сохранённой партии", () => {
  it("id записанной партии запоминается", () => {
    expect(KOD).toMatch(/saveGame\(sg\);\s*lastSavedGameIdRef\.current\s*=\s*\{id:sg\.id,fp:gameStartTimeRef\.current\}/);
  });

  it("досохранение идёт по id, а не по «первой в списке»", () => {
    const i = KOD.indexOf("function updateGameAnalysis");
    expect(i, "функции досохранения нет").toBeGreaterThan(-1);
    const telo = KOD.slice(i, KOD.indexOf("\n}", i));
    expect(telo, "ищет партию по id").toContain("findIndex");
    expect(telo).toContain("g.id === id");
  });

  it("вызывается после анализа, а не до", () => {
    const posleAnaliza = KOD.indexOf("await runAnalysis(10)");
    const vyzov = KOD.indexOf("updateGameAnalysis(id", posleAnaliza);
    expect(posleAnaliza, "авто-анализ не найден").toBeGreaterThan(-1);
    expect(vyzov, "досохранение не идёт следом за анализом").toBeGreaterThan(posleAnaliza);
  });

  it("падение истории не роняет игру", () => {
    const i = KOD.indexOf("function updateGameAnalysis");
    const telo = KOD.slice(i, KOD.indexOf("\n}", i));
    expect(telo, "нет защиты от сбоя хранилища").toContain("catch");
  });
});
