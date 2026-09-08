import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MATERIALS } from "./materials";
import { CEILING_STRETCH, FLOOR_WET, WALL_BLOCK, WALL_FRAME, finishedHeightM, totalMm } from "./wallStructure";
import { WALL_HEIGHT } from "./planModel";

/**
 * Числа, которые модуль обещает СЛОВАМИ, обязаны совпадать с кодом.
 *
 * Повод конкретный и свежий: описание QSpace в реестре платформы за один день
 * разошлось с продуктом — там осталось «JPEG/PDF не разбираются», когда оба
 * формата уже работали. Прозу никто не проверяет, поэтому она стареет молча,
 * а читают её и покупатель, и соседняя вкладка.
 *
 * Здесь сверяются ДВА наших собственных ответа об одном и том же: описание в
 * реестре бэкенда против массивов в коде фронта. Расхождение — красный.
 */

const REGISTRY = path.resolve(
  __dirname, "..", "..", "..", "..",
  "aevion-globus-backend", "src", "data", "projects.ts",
);

function qspaceDescription(): string {
  const src = readFileSync(REGISTRY, "utf8");
  const start = src.indexOf('id: "qspace"');
  expect(start, "записи qspace нет в реестре").toBeGreaterThan(-1);
  const end = src.indexOf('id: "qskyway"', start);
  return src.slice(start, end > start ? end : start + 6000);
}

/** Число из фразы вида «каталог 14 материалов». */
function claimedNumber(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
}

describe("описание QSpace в реестре не расходится с кодом", () => {
  const text = qspaceDescription();

  it("число материалов в описании равно длине каталога", () => {
    const claimed = claimedNumber(text, /каталог (\d+) материалов/);
    expect(claimed, "в описании нет фразы «каталог N материалов»").not.toBeNull();
    expect(claimed).toBe(MATERIALS.length);
  });

  it("число предметов мебели равно каталогу в клиенте", () => {
    const claimed = claimedNumber(text, /(\d+) предмет/);
    expect(claimed, "в описании нет фразы «N предметов»").not.toBeNull();
    const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
    // считаем позиции каталога мебели по их обязательному полю group
    const actual = (client.match(/\bgroup:\s*"/g) || []).length;
    expect(actual, "каталог мебели не найден в _client.tsx").toBeGreaterThan(5);
    expect(claimed).toBe(actual);
  });

  it("толщины конструкций в описании — те же, что считает код", () => {
    expect(claimedNumber(text, /пирог пола (\d+) мм/)).toBe(totalMm(FLOOR_WET));
    expect(claimedNumber(text, /газоблок (\d+) мм/i)).toBe(totalMm(WALL_BLOCK));
    expect(claimedNumber(text, /каркас ГКЛ (\d+) мм/)).toBe(totalMm(WALL_FRAME));
    expect(claimedNumber(text, /потолок (\d+) мм/)).toBe(totalMm(CEILING_STRETCH));
  });

  it("обещанная чистовая высота — результат расчёта, а не круглое число из головы", () => {
    const m = /(\d+\.\d+) м после ремонта/.exec(text);
    expect(m, "в описании нет фразы «N.NN м после ремонта»").not.toBeNull();
    const real = finishedHeightM(WALL_HEIGHT, FLOOR_WET, CEILING_STRETCH);
    expect(Number(m![1])).toBeCloseTo(Number(real.toFixed(2)), 6);
  });

  it("описание не обещает того, чего модуль не делает", () => {
    // проёмы из чертежа НЕ распознаются — описание обязано это признавать,
    // а не молчать: молчание читается как «умеет»
    expect(text).toMatch(/проёмы.{0,60}не распознаются/i);
    // и не должно утверждать обратное
    expect(/распознаёт проёмы|двери и окна из чертежа/i.test(text)).toBe(false);
  });

  it("контроль прибора: выдуманной фразы в описании НЕ находится", () => {
    // без этого «совпало» неотличимо от «мой поиск находит что угодно»
    expect(claimedNumber(text, /каталог (\d+) единорогов/)).toBeNull();
  });
});
