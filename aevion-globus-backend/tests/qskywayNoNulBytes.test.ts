import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * В исходниках модуля нет байтов NUL.
 *
 * ПОВОД. За одну ночь я занёс NUL дважды: сперва в заметку передачи, потом —
 * в ту самую строку правил, которая про этот механизм и написана. Способ один
 * и тот же: обратные слэши съедаются на границе вызова, `\x00` доезжает как
 * `\x00`, и python читает это как escape-последовательность.
 *
 * Почему это не косметика: от ОДНОГО такого байта git считает весь файл
 * ДВОИЧНЫМ. Диффы приходят как `Bin 150845 -> 152909 bytes` вместо строк,
 * ревью становится невозможным, а мерж пошёл бы двоичным конфликтом — то есть
 * человеку пришлось бы выбирать сторону целиком. Для файла с кодом это дороже,
 * чем для заметки.
 *
 * Ищем в СВОЁМ модуле: чужие зоны не наша забота (в `qventure/deckExtract.ts`
 * такой байт есть намеренно — регулярка, вычищающая NUL, — и трогать его
 * отсюда нельзя).
 */
const ROOTS = [
  path.join(__dirname, "..", "src", "routes"),
  path.join(__dirname, "..", "src", "lib"),
  // И САМИ ТЕСТЫ. Первая версия смотрела только src — и не поймала NUL,
  // который я занёс в ЭТОТ ЖЕ файл, пока его писал. Сторож, не проверяющий
  // себя, ловит всех кроме автора.
  __dirname,
];
const MINE = /qskyway|slotOrigin|trustAnchor|opentimestamps/i;
const TEXT = /\.(ts|tsx|json|md)$/i;

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

// ⚠️ Сопоставляем только ИМЯ ФАЙЛА, а не полный путь. Первая версия
// фильтровала по абсолютному пути — а он начинается с каталога worktree
// `aevion-qskyway`, поэтому «мой модуль» совпал со ВСЕМ репозиторием, и
// сторож покраснел на чужом файле. Область проверки должна задаваться тем,
// что проверяем, а не тем, где мы случайно лежим.
const FILES = ROOTS.flatMap(walk).filter((p) => MINE.test(path.basename(p)));

describe("исходники модуля свободны от байтов NUL", () => {
  test("файлы вообще нашлись — иначе проверка пустая", () => {
    // Отрицательный контроль: сломается обход каталогов — список станет пустым
    // и цикл ниже не выполнится ни разу, оставшись зелёным.
    expect(FILES.length, "обход каталогов ничего не нашёл").toBeGreaterThan(5);
  });

  for (const file of FILES) {
    test(path.basename(file) + " — без NUL", () => {
      const buf = readFileSync(file);
      const at = buf.indexOf(0);
      expect(
        at,
        "байт NUL на позиции " + at + ": git будет считать файл ДВОИЧНЫМ, "
          + "диффы придут как Bin и ревью станет невозможным",
      ).toBe(-1);
    });
  }
});
