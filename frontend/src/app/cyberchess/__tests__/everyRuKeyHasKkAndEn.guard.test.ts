import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * У каждого ключа ru есть kk и en.
 *
 * Замер 21.10.2026 (yazyk-devhub.mjs --click «первую партию», прод a26c5584c):
 * у kk на игровом экране «Анализ варианта», «Игра за белых», подпись доски.
 * В kk не было 50 из 319 ключей, tFor молча брал русский — снаружи это не
 * ошибка, а просто «не тот язык». Тот же класс уже стоил 05.10 (tc.*).
 */

const SRC = fs.readFileSync(path.resolve(__dirname, "..", "i18n.ts"), "utf8");

export function klyuchiBlokov(src: string): Record<"ru" | "en" | "kk", Set<string>> {
  const lines = src.split("\n");
  const start = (l: string) => lines.findIndex((x) => x.startsWith(`  ${l}: {`));
  const [a, b, c] = [start("ru"), start("en"), start("kk")];
  const end = lines.findIndex((x, i) => i > c && /^};/.test(x));
  const keys = (x: number, y: number) => new Set(lines.slice(x, y).map((l) => (l.match(/^\s+"([^"]+)":/) || [])[1]).filter(Boolean) as string[]);
  return { ru: keys(a, b), en: keys(b, c), kk: keys(c, end) };
}

describe("словарь CyberChess: kk и en не отстают от ru", () => {
  test("прибор видит пропуск и не клевещет на полный словарь", () => {
    const poln = 'const D = {\n  ru: {\n    "a": "x",\n  },\n  en: {\n    "a": "y",\n  },\n  kk: {\n    "a": "z",\n  },\n};\n';
    const k = klyuchiBlokov(poln);
    expect([k.ru.size, k.en.size, k.kk.size], "прибор ослеп — блоки не разобраны").toEqual([1, 1, 1]);
    const dyra = klyuchiBlokov(poln.replace('    "a": "z",\n', ""));
    expect([...dyra.ru].filter((x) => !dyra.kk.has(x)), "прибор не видит пропуск").toEqual(["a"]);
  });

  test("блоки найдены и ни один ключ ru не пропущен", () => {
    const k = klyuchiBlokov(SRC);
    expect(k.ru.size, "блок ru не найден — разметка сменилась").toBeGreaterThan(300);
    expect([...k.ru].filter((x) => !k.kk.has(x)), "ключ ru без kk — казахский экран покажет русский").toEqual([]);
    expect([...k.ru].filter((x) => !k.en.has(x)), "ключ ru без en — английский экран покажет русский").toEqual([]);
  });
});
