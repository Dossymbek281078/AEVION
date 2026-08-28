import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Лимит тарифа проверяется ДО платного вызова, а не после.
 *
 * Порядок здесь — денежный вопрос, а не стилистический. Если провайдера
 * позвали раньше проверки, то человек, исчерпавший лимит, всё равно потратил
 * НАШИ деньги: генерация выполнена, счёт от провайдера придёт, а в ответ ему
 * уйдёт отказ. Заметить это по журналам почти невозможно — расход есть,
 * выданного результата нет.
 *
 * Замер 28.08.2026: восемь учитываемых ручек, у всех порядок верный. Сторож
 * написан не на находку, а на СОХРАНЕНИЕ свойства: добавляя новую платную
 * возможность, легко позвать провайдера первым, и ничего не упадёт.
 */

const FILE = path.join(__dirname, "..", "src", "routes", "devhub.ts");

type Site = { capability: string; check: number; external: number | null };

function sites(): Site[] {
  const lines = fs.readFileSync(FILE, "utf8").split("\n");
  const starts = lines.map((l, i) => (l.startsWith("devhubRouter.") ? i : -1)).filter((i) => i >= 0);
  const out: Site[] = [];
  lines.forEach((l, i) => {
    if (!l.includes("await checkCredit(")) return;
    const capability = l.split('"')[1] ?? "?";
    const end = starts.find((s) => s > i) ?? lines.length;
    let external: number | null = null;
    for (let j = i + 1; j < end; j++) {
      const s = lines[j].trim();
      // Платный вызов наружу: запрос к провайдеру или выкатка через wrangler.
      if (s.includes("await fetch(") || s.includes("deployViaWrangler(")) { external = j + 1; break; }
    }
    out.push({ capability, check: i + 1, external });
  });
  return out;
}

describe("лимит проверяется до траты", () => {
  test("прибор работает: ручки находятся и у них есть внешние вызовы", () => {
    const s = sites();
    // Пустой список означал бы «нарушений нет» при неработающем разборе —
    // самый спокойный из ложных зелёных.
    expect(s.length, "учитываемых ручек не найдено — сторож смотрит не туда").toBeGreaterThan(5);
    expect(
      s.filter((x) => x.external !== null).length,
      "ни у одной ручки не найден платный вызов — разбор сломан",
    ).toBeGreaterThan(3);
  });

  test("ни одна ручка не зовёт провайдера раньше проверки", () => {
    const bad = sites()
      .filter((x) => x.external !== null && x.check > x.external)
      .map((x) => `${x.capability}: проверка на ${x.check}, платный вызов на ${x.external}`);
    expect(bad, "исчерпавший лимит тратит наши деньги").toEqual([]);
  });

  test("у каждой учитываемой возможности проверка вообще есть", () => {
    // Возможности берём из таблицы лимитов, а не из своей головы: список,
    // переписанный руками, повторяет ошибку источника.
    const src = fs.readFileSync(FILE, "utf8");
    const block = src.slice(src.indexOf("const TIER_LIMITS"), src.indexOf("async function getUserTierChecked"));
    const metered = [...block.matchAll(/(?:^|[\s{,])([a-z_]+):\s*-?\d+/gm)].map((m) => m[1]);
    const unique = [...new Set(metered)].filter((c) => c !== "free" && c !== "pro");
    const checked = new Set(sites().map((s) => s.capability));
    const missing = unique.filter((c) => !checked.has(c));
    expect(unique.length, "таблица лимитов не разобрана").toBeGreaterThan(2);
    expect(missing, "возможность из таблицы лимитов нигде не проверяется").toEqual([]);
  });
});

/**
 * Проверка ДОЛЖНА уметь отказать.
 *
 * Мутация 28.08.2026: заменил `TIER_LIMITS[tier][capability]` на `-1`, то есть
 * сделал все пределы безлимитными — сторож выше остался ЗЕЛЁНЫМ. Он охраняет
 * ПОРЯДОК (проверка раньше вызова провайдера) и НАЛИЧИЕ проверки, но не то,
 * что проверка способна сказать «нет».
 *
 * Для бесплатного тарифа безлимит на платной возможности означает раздачу
 * наших денег: проверка отработает, вернёт allowed и пропустит любой объём.
 */
describe("предел способен отказать", () => {
  const SRC = fs.readFileSync(FILE, "utf8");

  test("прибор исправен: таблица пределов найдена", () => {
    expect(SRC.indexOf("const TIER_LIMITS"), "таблица не найдена").toBeGreaterThan(0);
  });

  test("у бесплатного тарифа платные возможности НЕ безлимитны", () => {
    const i = SRC.indexOf("const TIER_LIMITS");
    const free = SRC.slice(SRC.indexOf("free:", i), SRC.indexOf("}", SRC.indexOf("free:", i)));
    const infinite = [...free.matchAll(/([a-z]+):\s*(-?\d+)/g)]
      .filter((m) => Number(m[2]) === -1)
      .map((m) => m[1]);
    expect(infinite, "бесплатный тариф раздаёт платное без предела").toEqual([]);
  });

  test("предел берётся из таблицы, а не из константы", () => {
    // Именно эту подмену пережил сторож: `const limit = -1`.
    expect(SRC).toContain("const limit = TIER_LIMITS[tier][capability];");
  });
});

/**
 * НАПРАВЛЕНИЕ отказа на денежном пути закреплено.
 *
 * Мутация 28.08.2026: поменял `allowed: true` на `false` в ветке «расход
 * прочитать не удалось» — ни один сторож не покраснел. А это значит, что
 * платящему начали бы отказывать во время заминки базы, и заметил бы это
 * только он.
 *
 * Выбор направления здесь сознательный и объяснён в коде: пропустить запрос —
 * меньшая ошибка, чем отказать заплатившему из-за нашего сбоя. Цена ошибки
 * несимметрична: одна неучтённая генерация против потерянного доверия.
 *
 * Молчание при этом НЕ разрешено: рядом уходит `usedKnown: false`, и ответ
 * честно говорит, что расход не проверен. Обе половины закреплены.
 */
describe("направление отказа при нечитаемом расходе", () => {
  const SRC = fs.readFileSync(FILE, "utf8");

  test("прибор исправен: ветка найдена", () => {
    expect(SRC.includes("if (used === null) {"), "ветка сбоя не найдена").toBe(true);
  });

  test("при нечитаемом расходе запрос ПРОПУСКАЕТСЯ", () => {
    expect(
      SRC.includes("return { allowed: true, used: 0, limit, tier, usedKnown: false };"),
      "платящему отказывают из-за нашего сбоя",
    ).toBe(true);
  });

  test("и это НЕ молчание: ответ помечен как непроверенный", () => {
    // Пропустить молча — отдельный дефект: целый неучтённый месяц не оставил
    // бы следа нигде.
    expect(SRC).toContain("usedKnown: false");
    expect(SRC).toContain("creditUnverified");
  });
});
