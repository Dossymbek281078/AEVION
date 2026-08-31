import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ни один исходник не содержит байт NUL.
 *
 * ЗАЧЕМ. От ОДНОГО такого байта git считает ВЕСЬ файл двоичным: diff
 * приходит как «Bin 9289 -> 16253 bytes», numstat отдаёт «- -», а коммит
 * выглядит пустым («0 insertions, 0 deletions»). Вычитать код в таком файле
 * нельзя, и мерж пошёл бы двоичным конфликтом.
 *
 * Замер 31.08.2026: байт лежал в lib/qventure/deckExtract.ts — в регулярке
 * чистки текста презентации. Он попал туда обычным для этой машины путём:
 * обратный слэш съедается на границе вызова, в исходнике задумывалось
 * "u0000" как ТЕКСТ, а доехал сам символ.
 *
 * ВАЖНАЯ ОГОВОРКА, чтобы следующий читатель не чинил не то: регулярка с
 * настоящим байтом NUL РАБОТАЕТ — проверено в node, оба варианта убирают
 * символ. То есть дефект был не в поведении, а в читаемости исходника.
 * Утверждение «чистка не делает ничего» было бы неверным.
 */
const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const EXTS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".css", ".ps1", ".sh", ".yml"];

function trackedSources(): string[] {
  // -z обязателен: без него git отдаёт неASCII-пути ЭКРАНИРОВАННЫМИ, и
  // проверка молча пропускает их. У нас кириллица в путях повсюду, поэтому
  // занижение выборки было бы почти гарантировано.
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split(String.fromCharCode(0))
    .filter((p) => p.length > 0 && EXTS.some((e) => p.endsWith(e)));
}

const NUL = String.fromCharCode(0);

describe("исходники не содержат байт NUL", () => {
  const files = trackedSources();

  test("контроль: перечисление файлов сработало", () => {
    // Пустой список дал бы «находок нет» на любом состоянии репозитория —
    // ровно тот ложный ноль, против которого сторож и написан.
    expect(files.length, "git ls-files вернул подозрительно мало путей").toBeGreaterThan(1000);
  });

  test("контроль: детектор умеет находить байт", () => {
    // Иначе «ноль находок» означал бы «не умею искать».
    expect(("a" + NUL + "b").includes(NUL), "детектор не видит подложенный байт").toBe(true);
    expect("ab".includes(NUL), "детектор находит байт там, где его нет").toBe(false);
  });

  test("ни в одном исходнике нет байта NUL", () => {
    const bad: string[] = [];
    for (const rel of files) {
      let buf: Buffer;
      try {
        buf = readFileSync(join(REPO, rel));
      } catch {
        // Файл в индексе, но не читается — это НЕ «чисто». Называем его,
        // иначе непрочитанный файл сойдёт за проверенный.
        bad.push(rel + " (не прочитался)");
        continue;
      }
      if (buf.includes(0)) bad.push(rel);
    }
    expect(
      bad,
      "от одного байта NUL git считает файл двоичным: diff станет «Bin X -> Y bytes», " +
        "коммит будет выглядеть пустым, и вычитать правку в этом файле будет нельзя. " +
        "Замените байт на экранированную запись (u0000 через обратный слэш).",
    ).toEqual([]);
  });
});
