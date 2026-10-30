// Каждый ключ tr("…") в ModulePricingChip есть в словарях ru/en/kk.
// Замер Продаж на проде 30.10.2026: боковая плашка подписки CyberChess показывала
// сырое «$50moduleChip.perYear» — ключа не было ни в одном словаре, а при
// подключённом провайдере tr() отдаёт i18n.t(key), и запасной русский текст не
// срабатывает. Ловим класс: новый ключ в чипе без записи в словари.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ru from "../../lib/i18n-lang/ru";
import en from "../../lib/i18n-lang/en";
import kk from "../../lib/i18n-lang/kk";

const src = readFileSync(join(__dirname, "..", "ModulePricingChip.tsx"), "utf8");
const ключи = [...new Set([...src.matchAll(/\btr\(\s*"([^"]+)"/g)].map((m) => m[1]))];

describe("ModulePricingChip: ключи перевода существуют", () => {
  it("ключи найдены (контроль прибора)", () => {
    expect(ключи.length).toBeGreaterThan(5);
    expect(ключи).toContain("moduleChip.perYear");
  });
  for (const [имя, словарь] of [["ru", ru], ["en", en], ["kk", kk]] as const) {
    it(`все ключи есть в ${имя}`, () => {
      const нет = ключи.filter((k) => !(k in (словарь as Record<string, string>)));
      expect(нет, `нет в ${имя}`).toEqual([]);
    });
  }
});
