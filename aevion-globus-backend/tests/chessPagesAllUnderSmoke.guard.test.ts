import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Каждая страница CyberChess обязана быть в списке сторожа страниц.
 *
 * Ворота запуска №7 требуют этого прямым текстом, но выполнялись они вручную —
 * значит рано или поздно не выполнились. Замер 27.08.2026: статических страниц
 * у модуля **18**, в `pages-live-smoke.js` — **17**. Вне сторожа осталась
 * `/cyberchess/offline`; на проде она отвечает 200 (контроль на выдуманный адрес
 * — 404), то есть страница живая и просто никем не проверялась. Пропади она —
 * никто бы не узнал: именно так `/go` однажды лежала часами.
 *
 * ПОЧЕМУ ТОЛЬКО ШАХМАТЫ. Сторож намеренно узкий. Тот же список по всей платформе
 * покраснел бы сразу и навсегда — страниц там сотни, а в смоуке 114, — а
 * постоянно красная проверка перестаёт читаться и защищает хуже, чем её
 * отсутствие. CyberChess — модуль запуска 30.08, у него полнота достижима и
 * проверяема сегодня.
 *
 * Динамические адреса (`[gameId]`, `[id]`) исключены: у них нет постоянного
 * URL, который можно открыть смоуком без готовых данных.
 */

const REPO_ROOT = path.join(__dirname, "..", "..");
const CHESS_APP_DIR = path.join(REPO_ROOT, "frontend", "src", "app", "cyberchess");
const SMOKE_FILE = path.join(__dirname, "..", "scripts", "pages-live-smoke.js");

/** Адреса статических страниц модуля, найденные по файловой системе. */
function chessPagesOnDisk(): string[] {
  const out: string[] = [];
  const walk = (dir: string, urlPrefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Динамический сегмент — постоянного адреса нет.
        if (entry.name.startsWith("[")) continue;
        walk(path.join(dir, entry.name), `${urlPrefix}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        out.push(urlPrefix);
      }
    }
  };
  walk(CHESS_APP_DIR, "/cyberchess");
  return out.sort();
}

function smokeList(): string[] {
  const src = fs.readFileSync(SMOKE_FILE, "utf8");
  const found = [...src.matchAll(/"(\/cyberchess[^"]*)"/g)].map((m) => m[1]);
  return [...new Set(found)].sort();
}

describe("ворота запуска №7: сторож знает все страницы CyberChess", () => {
  test("прибор сам себя проверяет: страниц найдено много, и главная среди них", () => {
    // Без этой проверки пустой обход дал бы «расхождений нет» — успокаивающий
    // ноль вместо ответа.
    const pages = chessPagesOnDisk();
    expect(pages.length).toBeGreaterThan(10);
    expect(pages).toContain("/cyberchess");

    const smoke = smokeList();
    expect(smoke.length).toBeGreaterThan(10);
    expect(smoke).toContain("/cyberchess");
  });

  test("ни одна страница не осталась вне сторожа", () => {
    const missing = chessPagesOnDisk().filter((p) => !smokeList().includes(p));
    expect(
      missing,
      "страница есть, а сторож её не открывает — пропади она, никто не узнает. Добавьте адрес в scripts/pages-live-smoke.js",
    ).toEqual([]);
  });

  test("в стороже нет адресов, которых уже нет в коде", () => {
    // Обратная сторона: удалённая страница оставляет сторожа вечно красным, и
    // его перестают читать.
    const gone = smokeList().filter((p) => !chessPagesOnDisk().includes(p));
    expect(gone, "сторож открывает адрес, страницы для которого больше нет").toEqual([]);
  });
});
