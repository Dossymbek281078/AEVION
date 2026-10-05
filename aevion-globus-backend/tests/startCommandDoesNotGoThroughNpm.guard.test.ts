import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: сервис запускается БЕЗ npm, и сигнал замены получает сам node.
 *
 * 🔴 Замер 01–02.10.2026. Обработчик SIGTERM мы привезли (lib/gracefulShutdown.ts),
 * а письма «Deploy Crashed!» не прекратились. В логе гаснущего экземпляра:
 *
 *     npm error signal SIGTERM
 *     npm error command sh -c node dist/index.js
 *
 * То есть сигнал приходил NPM, а не нашему процессу: npm был первым в цепочке,
 * уходил сам с ненулевым кодом, и платформа читала штатную замену как аварию.
 * Обработчик при этом был исправен — его просто никто не звал.
 *
 * Поэтому команда запуска обязана звать node НАПРЯМУЮ, и обязана делать это через
 * `exec`: без него оболочка остаётся родителем (`sh -c "cd … && node …"`), сигнал
 * получает ОНА, и дефект возвращается в новом обличье.
 *
 * ⚠️ ГРАНИЦА, которую этот сторож не переходит. Он читает ФАЙЛ настроек, а
 * платформа позволяет задать команду ещё и в панели — панель мы отсюда не видим.
 * Поэтому зелёный здесь означает «в репозитории правильно», а не «на проде
 * правильно». Правду даёт следующая выкатка: письма «Crashed» нет, а в логе есть
 * строка про замену экземпляра из gracefulShutdown.
 */

const КОРЕНЬ = join(__dirname, "..", "..");

describe("команда запуска сервиса", () => {
  test("настройка есть и разбирается", () => {
    const путь = join(КОРЕНЬ, "railway.json");
    expect(existsSync(путь), "railway.json в корне репозитория пропал").toBe(true);
    const д = JSON.parse(readFileSync(путь, "utf8")) as {
      deploy?: { startCommand?: string };
    };
    expect(typeof д.deploy?.startCommand, "в настройке нет deploy.startCommand").toBe("string");
  });

  test("npm в цепочке запуска НЕ участвует", () => {
    const к = (
      JSON.parse(readFileSync(join(КОРЕНЬ, "railway.json"), "utf8")) as {
        deploy: { startCommand: string };
      }
    ).deploy.startCommand;

    for (const запрещено of ["npm", "yarn", "pnpm"]) {
      expect(к, `запуск снова идёт через ${запрещено} — он и съедал SIGTERM`).not.toContain(запрещено);
    }
    expect(к, "должен запускаться сам node").toContain("node dist/index.js");
    // `exec` обязателен: иначе родителем остаётся оболочка и сигнал получает она.
    expect(к, "перед node нет exec — сигнал получит оболочка, а не node").toMatch(
      /exec\s+node\s+dist\/index\.js/,
    );
  });

  test("npm start остаётся рабочим для локального запуска", () => {
    // Контроль в обратную сторону: мы убираем npm ИЗ ПРОДА, а не ломаем его на
    // машине разработчика. Если бы скрипт start исчез, локальный запуск сломался бы
    // молча, и это выглядело бы как «починили прод, сломали всё остальное».
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.start, "скрипт start пропал").toBe("node dist/index.js");
  });
});
