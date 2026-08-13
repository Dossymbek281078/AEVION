import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./_stripComments";

/* Отказ сервера не должен превращаться в пустой список. 13.08.2026.
 *
 * Класс дефекта, найденный за эти два дня трижды: страница ловит ошибку
 * запроса и ставит пустой массив, а пустой массив подписан словами вроде
 * «Пока никто не решал» или «партий нет». В этот момент человеку сообщают
 * факт обо всех игроках, полученный из запроса, который не выполнился.
 *
 * Этот сторож ищет сам приём: в блоке `catch` состояние-список получает `[]`,
 * и при этом в том же блоке НЕ выставляется признак ошибки. Именно связка
 * «пусто + молчание» и опасна; `setItems([])` рядом с `setError(...)` —
 * нормальный код, потому что экран покажет ошибку, а не пустоту.
 */

const ROOT = "src/app/cyberchess";

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * Кусок кода после каждого `catch`, но не длиннее окна.
 *
 * Окно обязательно: в `cyberchess/page.tsx` мегабайт кода и 364 блока `catch`.
 * Первая версия шла по скобкам от каждого до конца файла — квадратично, и
 * воркер теста не отвечал минуту. Обработчик ошибки длиннее двух тысяч знаков
 * — сам по себе странность; для нашей проверки этого хватает с запасом.
 */
const WINDOW = 2000;

function catchBlocks(src: string): string[] {
  const blocks: string[] = [];
  const re = /catch\s*(\([^)]*\))?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const from = re.lastIndex;
    const limit = Math.min(src.length, from + WINDOW);
    let depth = 1;
    let i = from;
    while (i < limit && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    blocks.push(src.slice(from, i));
  }
  return blocks;
}

const EMPTY_ASSIGN = /set[A-Z][A-Za-z0-9_]*\(\s*\[\s*\]\s*\)/;
const SAYS_SOMETHING = /set[A-Za-z0-9_]*(Error|Failed|Unavailable|Problem)\s*\(|setStandingsFailed|setMyWalletFailed/;

describe("отказ сервера не выдаётся за пустоту", () => {
  const files = tsxFiles(ROOT);

  it("страницы шахмат вообще найдены — иначе сторож проверяет пустоту", () => {
    // Без этого сторож зелен на пустом множестве: каталог переименуют, и он
    // молча перестанет что-либо проверять.
    expect(files.length).toBeGreaterThan(5);
  });

  it("ни один catch не ставит пустой список молча", () => {
    const guilty: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const raw of catchBlocks(src)) {
        // Комментарии режем на маленьком куске, а не на всём файле: разбор
        // мегабайта ради каждого блока — та же квадратичность с другой стороны.
        const block = stripComments(raw);
        if (EMPTY_ASSIGN.test(block) && !SAYS_SOMETHING.test(block)) {
          guilty.push(`${f}: ${block.trim().slice(0, 90).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(guilty).toEqual([]);
  });
});
