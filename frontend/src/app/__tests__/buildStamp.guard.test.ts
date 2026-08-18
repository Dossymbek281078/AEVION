import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Отметка версии обязана ДОЕХАТЬ до сборки.
 *
 * Два способа тихо её потерять, оба уже случались на платформе:
 *
 *  1. Заигнорить файл. `vercel --prod` и `railway up` уважают игнор-списки, и
 *     отметка просто не попадает в артефакт. Бэкенд наступил на это 14.08.2026
 *     («build-info.json в игноре НЕ ДЕРЖАТЬ» — §12 общих правил).
 *  2. Отвязать генерацию от сборки. Скрипт, который никто не зовёт, — это
 *     отметка, которой нет; при этом в репозитории всё выглядит сделанным.
 *
 * Обе поломки молчаливые: сайт работает, сборка «успешна», и обнаруживается
 * пропажа ровно тогда, когда отметка нужна, — при разборе «что сейчас на
 * проде».
 */
const FRONT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCRIPT = join(FRONT, "scripts", "write-build-info.mjs");
const OUT = join(FRONT, "public", "version.json");

let stamp: Record<string, string> = {};

beforeAll(() => {
  // Скрипт зовём сами, а не ждём файл: в CI тесты идут ДО сборки, и
  // проверка «файл на месте» была бы красной всегда — то есть бесполезной.
  execFileSync(process.execPath, [SCRIPT], { stdio: "ignore" });
  stamp = JSON.parse(readFileSync(OUT, "utf8"));
});

describe("отметка версии фронтенда", () => {
  it("скрипт существует и вызывается сборкой", () => {
    expect(existsSync(SCRIPT), "нет scripts/write-build-info.mjs").toBe(true);
    const pkg = JSON.parse(readFileSync(join(FRONT, "package.json"), "utf8"));
    // npm зовёт prebuild автоматически перед build — так генерация привязана
    // к сборке, а не к памяти того, кто выкатывает.
    expect(pkg.scripts?.prebuild, "prebuild не зовёт генератор отметки").toMatch(
      /write-build-info/,
    );
  });

  it("отдаёт все поля, по которым отвечают на вопрос «что на сайте»", () => {
    for (const field of ["commit", "branch", "builtAt", "source"]) {
      expect(stamp[field], `в отметке нет поля ${field}`).toBeTruthy();
    }
    expect(new Date(stamp.builtAt).toString(), "builtAt не разбирается как дата").not.toBe(
      "Invalid Date",
    );
  });

  it("файл НЕ заигнорен — иначе он не доедет до сборки", () => {
    // Контроль прибора: git обязан подтвердить, что заведомо игнорируемый путь
    // игнорируется. Иначе «не игнорируется» может означать «git не ответил».
    const ignored = (p: string): boolean => {
      try {
        execFileSync("git", ["check-ignore", "-q", p], { cwd: FRONT, stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    };
    expect(ignored("node_modules"), "контроль: git не считает node_modules игнорируемым").toBe(true);
    expect(ignored("public/version.json"), "отметка заигнорена — до сборки не доедет").toBe(false);
  });

  it("не исключён и из .vercelignore", () => {
    const p = join(FRONT, "..", ".vercelignore");
    if (!existsSync(p)) return;
    const rules = readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const hits = rules.filter((r) => /(^|\/)public\/?$/.test(r) || r.includes("version.json"));
    expect(hits, "правило исключает отметку из выкатки").toEqual([]);
  });
});
