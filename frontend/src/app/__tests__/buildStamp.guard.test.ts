import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

  it("не понижает привезённую отметку до unknown", () => {
    // Случай Vercel: сборка идёт на ЧУЖОЙ машине, git там недоступен и
    // переменных VERCEL_GIT_* при заливке из каталога тоже нет. Скрипт
    // запускается там второй раз — и раньше затирал честную отметку,
    // привезённую с собой. Воспроизводится запуском вне git-репозитория.
    const tmp = mkdtempSync(join(tmpdir(), "stamp-"));
    mkdirSync(join(tmp, "scripts"), { recursive: true });
    mkdirSync(join(tmp, "public"), { recursive: true });
    copyFileSync(SCRIPT, join(tmp, "scripts", "write-build-info.mjs"));

    const brought = { commit: "abc123456789", branch: "deploy/x", builtAt: "2026-08-19T00:00:00.000Z", source: "git" };
    const out = join(tmp, "public", "version.json");
    writeFileSync(out, JSON.stringify(brought, null, 2), "utf8");

    execFileSync(process.execPath, [join(tmp, "scripts", "write-build-info.mjs")], {
      cwd: tmp,
      stdio: "ignore",
    });

    expect(JSON.parse(readFileSync(out, "utf8")).commit, "привезённую отметку затёрли").toBe(
      brought.commit,
    );
  });

  it("без отметки и без git пишет честное unknown, а не пустоту", () => {
    const tmp = mkdtempSync(join(tmpdir(), "stamp-"));
    mkdirSync(join(tmp, "scripts"), { recursive: true });
    copyFileSync(SCRIPT, join(tmp, "scripts", "write-build-info.mjs"));
    execFileSync(process.execPath, [join(tmp, "scripts", "write-build-info.mjs")], {
      cwd: tmp,
      stdio: "ignore",
    });
    const j = JSON.parse(readFileSync(join(tmp, "public", "version.json"), "utf8"));
    // «Не смогли определить» обязано быть видно, иначе оно неотличимо от
    // «совпало»: source называет причину.
    expect(j.commit).toBe("unknown");
    expect(j.source).toBe("none");
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

  it("НЕ попал в репозиторий — иначе отметка начнёт врать при каждом мерже", () => {
    // Файл обязан жить незакоммиченным: заигнорить его нельзя (не доедет до
    // сборки — проверено 14.08 на бэкенде), а `git add -A` затащит его молча.
    // Закоммиченная отметка начинает конфликтовать при слияниях и показывать
    // чужую ветку как свою.
    const tracked = (p: string): boolean => {
      try {
        execFileSync("git", ["ls-files", "--error-unmatch", p], { cwd: FRONT, stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    };
    // Контроль прибора: заведомо отслеживаемый файл обязан определиться как
    // отслеживаемый, иначе «не в репозитории» означало бы «git не ответил».
    expect(tracked("package.json"), "контроль: git не видит package.json").toBe(true);
    expect(
      tracked("public/version.json"),
      "отметка закоммичена — уберите её из индекса: git rm --cached frontend/public/version.json",
    ).toBe(false);
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
