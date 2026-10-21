import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RANKS } from "../rating";

/**
 * Игровой экран: четыре русских литерала, которые 21.10.2026 видел en-посетитель
 * (yazyk-devhub.mjs --click, прод a26c5584c): «Вы · 800 · Новичок» в табличке
 * игрока, «Ходы» над списком ходов, «Войти →» в «Анализе варианта».
 */

const P = fs.readFileSync(path.resolve(__dirname, "..", "page.tsx"), "utf8");

describe("игровой экран не зашивает русский", () => {
  test("литералов больше нет, вместо них словарь", () => {
    expect(P.includes("color:CC.text}}>Вы</span>"), "«Вы» зашито").toBe(false);
    expect(P.includes(">Войти →</button>"), "«Войти →» зашито").toBe(false);
    expect(P.includes('as const}}>Ходы</div>'), "«Ходы» зашито").toBe(false);
    expect(P.includes("{gRank(rat).t}"), "звание берётся только русским полем").toBe(false);
    expect(P).toContain('cc.t("game.you")');
    expect(P).toContain('cc.t("rp.moves")');
  });

  test("у каждого звания есть en и kk без кириллицы в en", () => {
    for (const r of RANKS as Array<{ t: string; en: string; kk?: string }>) {
      expect(r.en, r.t).toMatch(/^[^А-Яа-яЁё]+$/);
      expect(r.kk, `${r.t}: нет kk`).toBeTruthy();
    }
  });
});
