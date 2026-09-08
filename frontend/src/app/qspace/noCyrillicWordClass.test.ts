import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * В регулярках модуля не должно быть \w и \b рядом с кириллицей.
 *
 * Повод. В JavaScript `\w` — это ровно `[A-Za-z0-9_]`, а `\b` строится на нём
 * же. С русскими словами они не совпадают НИКОГДА, и шаблон вида
 * `/тёпл\w+ пол/` мёртв: он не находит ничего, но и не падает. Проверка с
 * таким шаблоном вечно зелена по несуществующему признаку — то есть её как
 * будто нет, а выглядит она работающей.
 *
 * За одно окно это случилось ДВАЖДЫ в моих же сторожах: «тёпл\w+ пол» (нашёл
 * покрасневший сторож) и «сохран\w+ в браузере» (нашёлся свипом после
 * первого случая — он держался только на второй половине условия).
 *
 * Поэтому не правило в голове, а проверка: правило помнят в момент набора
 * шаблона, а проверка помнит всегда.
 */

const DIR = __dirname;

/** Строки файла, где в одной строке есть и \w (или \b), и кириллица. */
function suspiciousLines(file: string): Array<{ line: number; text: string }> {
  const src = readFileSync(path.join(DIR, file), "utf8");
  const out: Array<{ line: number; text: string }> = [];
  src.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    // комментарии не считаем: в них про ловушку и написано
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    const hasClass = /\\w|\\b/.test(line);
    const hasCyrillic = /[А-Яа-яЁё]/.test(line);
    if (hasClass && hasCyrillic) out.push({ line: i + 1, text: trimmed.slice(0, 120) });
  });
  return out;
}

describe("регулярки модуля не используют \\w и \\b с кириллицей", () => {
  // Собственный файл исключён намеренно: сторож против ловушки ОБЯЗАН
  // содержать её примеры — иначе нечем показать, что он умеет находить.
  // Класс известный: «лекарство носит болезнь».
  const SELF = "noCyrillicWordClass.test.ts";
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && f !== SELF);

  it("файлов модуля для проверки найдено достаточно", () => {
    // контроль охвата: если список вдруг пуст, «нарушений нет» ничего не значит
    expect(files.length).toBeGreaterThan(15);
  });

  it("ни в одном файле нет \\w или \\b в строке с русскими словами", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const h of suspiciousLines(f)) bad.push(`${f}:${h.line}: ${h.text}`);
    }
    expect(
      bad,
      "\\w в JS не покрывает кириллицу — такой шаблон не совпадёт никогда, "
      + "и проверка будет вечно зелёной по несуществующему признаку",
    ).toEqual([]);
  });

  it("контроль прибора: подсунутая ловушка НАХОДИТСЯ", () => {
    // без этого «нарушений нет» неотличимо от «мой поиск ничего не умеет»
    const line = 'const re = /тёпл\\w+ пол/i;';
    const hasClass = /\\w|\\b/.test(line);
    const hasCyrillic = /[А-Яа-яЁё]/.test(line);
    expect(hasClass && hasCyrillic).toBe(true);
    // и обратный контроль: латинский шаблон без кириллицы — не находка
    const ok = 'const re = /^[a-z]+\\w*$/;';
    expect(/[А-Яа-яЁё]/.test(ok)).toBe(false);
  });

  it("и сама ловушка действительно не работает — а не просто «плохой стиль»", () => {
    // доказательство, а не утверждение: русское слово не совпадает с \w
    expect(/тёпл\w+ пол/i.test("тёплый пол")).toBe(false);
    expect(/тёплый пол/i.test("тёплый пол")).toBe(true);
  });
});
