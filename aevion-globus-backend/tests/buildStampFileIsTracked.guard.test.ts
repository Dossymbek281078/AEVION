import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Отметка выкатки обязана быть ОТСЛЕЖИВАЕМЫМ файлом.
 *
 * Замер 24.09.2026: код доезжал на прод, а `/health` отдавал commit unknown
 * четвёртый час — и из-за этого отказывали проверки выкатки у ВСЕХ окон.
 * Диагностика в журнале сборки назвала причину прямо:
 * «[build-info] … отметкаВКонтексте=НЕ ДОЕХАЛА», то есть файла не было в
 * контексте сборки, хотя .gitignore его не скрывает и в .railwayignore его нет.
 *
 * Отслеживаемый файл уезжает при любом устройстве архива. Поэтому в репозитории
 * лежит ЗАГЛУШКА с commit "unknown" (честная: при выкатке мимо скрипта /health
 * скажет «неизвестно», а не назовёт чужой коммит), а скрипт выкатки переписывает
 * её настоящим значением перед загрузкой и восстанавливает обратно на выходе.
 */
const root = join(__dirname, "..");

describe("отметка сборки", () => {
  it("файл build-info.json отслеживается git", () => {
    const out = execFileSync("git", ["ls-files", "build-info.json"], { cwd: root, encoding: "utf8" });
    expect(out.trim(), "build-info.json должен быть в индексе, иначе отметка не доедет в образ").not.toBe("");
  });

  it("в репозитории лежит именно заглушка, а не чужой коммит", () => {
    const p = join(root, "build-info.json");
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p, "utf8"));
    // Контроль в другую сторону: если кто-то закоммитит НАСТОЯЩИЙ коммит,
    // /health начнёт уверенно называть его на любой чужой сборке — это хуже
    // отсутствия отметки (§12, тот же класс, что удалённая переменная GIT_SHA).
    expect(j.commit, "в репозитории обязан лежать 'unknown', а не реальный sha").toBe("unknown");
  });

  it("скрипт выкатки восстанавливает заглушку, а не удаляет её", () => {
    const sh = readFileSync(join(root, "scripts", "railway-deploy.sh"), "utf8");
    expect(sh).toContain("checkout -- build-info.json");
  });
});
