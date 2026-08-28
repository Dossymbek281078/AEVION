import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Витрина модуля не говорит по-русски мимо словаря.
 *
 * Зеркало обычной беды с языком. Обычно ищут английский текст там, где ждут
 * русский; здесь наоборот: витрина переведена на три языка через словарь, и
 * жёстко вписанная РУССКАЯ строка останется русской для англоязычного и
 * казахоязычного посетителя — среди английского текста.
 *
 * Замер 29.08.2026: таких строк было две («Или начните с примера:», «Итого»),
 * и ни один сторож их не видел — проверка языка читает только файл рабочего
 * окна, а витрину не читает никто.
 */
const STORE = path.resolve(__dirname, "..", "page.tsx");
const SRC = fs.readFileSync(STORE, "utf8");
const LINES = SRC.split(String.fromCharCode(10));

function hardcodedRussian(): string[] {
  const out: string[] = [];
  LINES.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue0();
    let from = 0;
    for (;;) {
      const a = raw.indexOf(">", from);
      if (a < 0) break;
      const b = raw.indexOf("<", a + 1);
      if (b < 0) break;
      const t = raw.slice(a + 1, b).trim();
      from = b;
      if (!t || !/[а-яА-ЯёЁ]/.test(t)) continue;
      out.push(`${i + 1}: ${t.slice(0, 50)}`);
    }
  });
  return out;
  function continue0(): void {}
}

describe("витрина переводится целиком", () => {
  it("прибор исправен: файл прочитан и словарь используется", () => {
    expect(LINES.length, "файл витрины не прочитался").toBeGreaterThan(200);
    const dictCalls = (SRC.match(/t\(/g) || []).length;
    expect(dictCalls, "витрина не пользуется словарём — проверяется не тот файл").toBeGreaterThan(20);
  });

  // Долг закрыт 29.08.2026 тем же утром: все четыре строки заведены
  // ключами на трёх языках. Список оставлен ПУСТЫМ намеренно — он
  // показывает, что механизм долга есть, и следующая находка ляжет сюда,
  // а не потеряется.
  const PENDING: string[] = [];

  it("ни одной русской строки прямо в разметке", () => {
    expect(
      hardcodedRussian().filter((r) => !PENDING.some((k) => r.includes(k))),
      "текст вписан по-русски мимо словаря: для англоязычного посетителя он останется русским. Заведите ключ в i18n.ts на три языка",
    ).toEqual([]);
  });
});
