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
