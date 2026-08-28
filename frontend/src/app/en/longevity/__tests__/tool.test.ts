import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS, verdict } from "../_tool";

/**
 * Инструмент СЧИТАЕТ, и ошибка в нём была бы тихой: человек увидел бы
 * «в норме» на значении вне диапазона и ничего бы не заподозрил. Ни один
 * зелёный прогон страницы такого не покажет.
 *
 * Проверяются три вещи, каждая из которых уже была источником дефектов в
 * платформе:
 *   1. границы совпадают с ТЕКСТОМ, который показан рядом с полем;
 *   2. на самой границе вердикт не переворачивается;
 *   3. все границы взяты из протокола, а не сочинены.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, "..", "page.tsx"), "utf8");

describe("калькулятор отклонений", () => {
  it("ниже минимума — low, выше максимума — high", () => {
    expect(verdict(35, { min: 40, max: 60 })).toBe("low");
    expect(verdict(70, { min: 40, max: 60 })).toBe("high");
    expect(verdict(50, { min: 40, max: 60 })).toBe("ok");
    // Односторонние границы: у большинства маркеров задан только один край.
    expect(verdict(420, { min: 500 })).toBe("low");
    expect(verdict(9, { max: 8 })).toBe("high");
  });

  it("значение РОВНО на границе считается попаданием, а не отклонением", () => {
    // Протокол пишет «40–60» и «< 8». Ровно 40 — это внутри, ровно 8 — тоже:
    // сдвиг на единицу здесь превратил бы норму в тревогу у каждого, кто
    // попал точно в край.
    expect(verdict(40, { min: 40, max: 60 })).toBe("ok");
    expect(verdict(60, { min: 40, max: 60 })).toBe("ok");
    expect(verdict(8, { max: 8 })).toBe("ok");
    expect(verdict(500, { min: 500 })).toBe("ok");
  });

  it("подпись у поля не расходится с тем, по чему считают", () => {
    // Самый вероятный дефект при правке: поменяли число в границе и забыли
    // текст рядом (или наоборот). Тогда человек видит одно, а считается другое.
    for (const f of FIELDS) {
      const nums = f.target.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
      const bounds = [f.bound.min, f.bound.max].filter((x): x is number => x !== undefined);
      expect(nums.sort(), `${f.label}: подпись «${f.target}» не совпадает с границами`).toEqual(bounds.sort());
      if (f.target.startsWith("<")) expect(f.bound.min, `${f.label}: «<» но задан минимум`).toBeUndefined();
      if (f.target.startsWith(">")) expect(f.bound.max, `${f.label}: «>» но задан максимум`).toBeUndefined();
    }
  });

  it("каждый маркер формы есть в таблице протокола на странице", () => {
    // Границы не сочиняются: всё, что спрашиваем, названо в самом протоколе.
    for (const f of FIELDS) {
      const key = f.label.split(" (")[0];
      expect(PAGE, `${f.label}: нет в таблице страницы`).toContain(key);
    }
  });

  it("в форме нет маркеров, у которых нет однозначного числа", () => {
    // «by sex and age» и «upper third of range» машинно сравнивать нельзя, и
    // выдавать по ним вердикт значило бы обещать точность, которой нет.
    for (const f of FIELDS) {
      expect(
        f.bound.min !== undefined || f.bound.max !== undefined,
        `${f.label}: попал в форму без числовой границы`,
      ).toBe(true);
    }
    expect(FIELDS.length).toBeGreaterThanOrEqual(10);
  });
});
