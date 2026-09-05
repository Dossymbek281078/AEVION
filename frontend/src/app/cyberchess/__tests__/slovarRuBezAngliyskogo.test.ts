import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Русский словарь модуля держал английские значения: «Login streak»,
 * «OFFLINE», «FINISHED», «👑 host», «P2P LIVE», «🔴 LIVE» — шесть из 166.
 * Найдено обходом экранов: на профиле человек видел «LOGIN STREAK»
 * (заглавные — от оформления, в словаре строка была обычная).
 *
 * Имена собственные исключены списком: FIDE, названия сервисов и продукта —
 * это названия, а не непереведённый текст.
 */

const I18N = () => readFileSync(join(process.cwd(), "src/app/cyberchess/i18n.ts"), "utf8");
const KIRILLICA = /[А-Яа-яЁё]/;
const IMENA = /^(CyberChess|Chessy|AEVION|Lichess|Stockfish|FIDE|ELO|CPI|PGN|FEN|QR|Puzzle Rush)$/i;

function chast(s: string, ot: string, do_: string): Array<{ k: string; v: string }> {
  const a = s.indexOf(ot), b = do_ ? s.indexOf(do_) : s.length;
  return [...s.slice(a, b).matchAll(/^\s+"([^"]+)":\s+"([^"]*)"/gm)].map((m) => ({ k: m[1], v: m[2] }));
}

describe("русский словарь модуля без английских значений", () => {
  const s = I18N();
  const ru = chast(s, "  ru: {", "  en: {");
  const en = chast(s, "  en: {", "  kk: {");

  it("словарь прочитан", () => {
    // Контроль прибора: пустой список дал бы зелёный «всё переведено».
    expect(ru.length).toBeGreaterThan(100);
    expect(ru.some((p) => p.k === "stats.card.login_streak")).toBe(true);
  });

  it("прибор умеет находить английское — проверено на английском словаре", () => {
    // Без этой строки «ноль находок» в русском ничего не значил бы.
    const bez = en.filter((p) => p.v && !KIRILLICA.test(p.v) && /[A-Za-z]{3}/.test(p.v));
    expect(bez.length).toBeGreaterThan(50);
  });

  it("в русских значениях нет английского текста", () => {
    const bez = ru
      .filter((p) => p.v && !KIRILLICA.test(p.v) && /[A-Za-z]{3}/.test(p.v))
      .filter((p) => !IMENA.test(p.v.trim()))
      .map((p) => `${p.k} = ${p.v}`);
    expect(bez).toEqual([]);
  });
});
