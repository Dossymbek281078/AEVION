// Храповик на небезопасную запись в файловое хранилище.
//
// За один заход 2026-08-10 одна и та же ошибка нашлась в четырёх модулях:
// «прочитал файл → изменил → записал» тремя отдельными await, без замка.
// Параллельные запросы читали одну версию и затирали друг друга. Отказа
// при этом не было ни разу — ответы 200, файлы валидные, данных меньше.
// Дошло до того, что в кошельке AEV проходили все десять одновременных
// списаний при балансе на одно.
//
// Чинить каждый случай по отдельности недостаточно: способ написать так
// снова остался. Этот тест держит список файлов, которым ещё разрешено
// звать writeJsonFile напрямую, и валится, как только появляется новый.
//
// Что делать, если тест упал:
//   • пишете НОВЫЙ код — возьмите updateJsonFile(rel, fallback, mutator):
//     чтение, изменение и запись идут под замком на файл. И отвечайте
//     клиенту ПОСЛЕ await, а не изнутри мутатора — иначе 200 уходит до
//     фактической записи (наступал на это в smeta-trainer);
//   • ПОЧИНИЛИ файл из списка — уменьшите его число здесь. Так храповик
//     затягивается и назад уже не отпускает;
//   • запись действительно полная (новое значение не зависит от старого) —
//     writeJsonFile подходит, добавьте файл в список с пояснением почему.

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "src");

/**
 * Сколько прямых вызовов writeJsonFile ещё допустимо в каждом файле.
 * Ноль означает: файла тут быть не должно вовсе.
 */
const ALLOWED: Record<string, { count: number; why: string }> = {
  "lib/ecosystemStore.ts": {
    count: 3,
    why:
      "Известный долг: read-modify-write по турнирам. Зона cyberchess занята " +
      "другой сессией — переводить должен её владелец.",
  },
  "routes/qtrade.ts": {
    count: 1,
    why:
      "Безопасно по устройству: состояние живёт в памяти, на диск уходит готовый " +
      "снапшот через собственную последовательную цепочку. Новое значение от " +
      "прочитанного не зависит.",
  },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function countWrites(file: string): number {
  const text = readFileSync(file, "utf8");
  return (text.match(/\bwriteJsonFile\s*\(/g) ?? []).length;
}

describe("jsonFileStore: храповик на прямую запись", () => {
  test("новых прямых writeJsonFile не появилось", () => {
    const actual: Record<string, number> = {};
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      if (rel === "lib/jsonFileStore.ts") continue; // сам модуль хранилища
      const n = countWrites(file);
      if (n > 0) actual[rel] = n;
    }

    const unexpected = Object.keys(actual).filter((f) => !ALLOWED[f]);
    expect(
      unexpected,
      `Новая прямая запись в файловое хранилище: ${unexpected.join(", ")}. ` +
        "Возьмите updateJsonFile — он держит замок на файл от чтения до записи. " +
        "Если запись действительно полная, добавьте файл в ALLOWED с пояснением.",
    ).toEqual([]);

    for (const [file, { count }] of Object.entries(ALLOWED)) {
      const n = actual[file] ?? 0;
      expect(
        n,
        n > count
          ? `В ${file} стало больше прямых writeJsonFile (${n} против ${count}). Так этот класс дефектов и возвращается.`
          : `В ${file} осталось ${n} прямых writeJsonFile вместо ${count} — похоже, починено. Уменьшите число в ALLOWED, чтобы храповик затянулся.`,
      ).toBe(count);
    }
  });

  test("updateJsonFile действительно есть в хранилище — совет из сообщения выполним", () => {
    const store = readFileSync(path.join(SRC, "lib", "jsonFileStore.ts"), "utf8");
    expect(store).toContain("export function updateJsonFile");
  });
});
