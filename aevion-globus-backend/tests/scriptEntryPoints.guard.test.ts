import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Скрипт без точки входа в package.json — сирота: файл жив, вызвать штатно нельзя.
 *
 * Случай, ради которого сторож написан. 30.04.2026 коммит `8d152a864` добавил
 * `scripts/backup.mjs`, `scripts/restore.mjs` И три команды в package.json:
 * `backup`, `backup:list`, `restore`. К 14.08 файлы на месте, а команд **не
 * осталось ни одной** — ни в этой ветке, ни в пяти других, где package.json
 * правили. Никто не заметил, потому что ничего не сломалось: сборка зелёная,
 * тесты зелёные, просто резервного копирования нет.
 *
 * Цена конкретная: в этом хранилище лежат `aev_wallets.json` и
 * `aev_ledger.json` — кошельки и append-only реестр AEV (Postgres для них ещё
 * в планах, см. шапку `src/routes/aev.ts`). А RUNBOOK при этом ссылался на
 * `npm run backup` как на существующую процедуру.
 *
 * Сторож проверяет только те скрипты, которые ОБЯЗАНЫ быть вызываемы штатно, —
 * список ниже. Проверять все файлы в scripts/ смысла нет: часть из них
 * запускается по пути из планировщика или из другого скрипта, и требовать для
 * них npm-команду значило бы плодить записи ради зелёного теста.
 */

const PKG = join(__dirname, "..", "package.json");
const SCRIPTS_DIR = join(__dirname, "..", "scripts");

/** Скрипт → команда, которой его зовут. Обе стороны обязаны существовать. */
const MUST_BE_CALLABLE: { file: string; command: string; why: string }[] = [
  {
    file: "backup.mjs",
    command: "backup",
    why: "резервная копия JSON-хранилища, включая кошельки и реестр AEV",
  },
  {
    file: "restore.mjs",
    command: "restore",
    why: "восстановление из копии — без него копия остаётся верой, а не бэкапом",
  },
];

describe("сторож: у скриптов бэкапа есть точка входа", () => {
  const pkg = JSON.parse(readFileSync(PKG, "utf8")) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};

  test("package.json прочитан и содержит скрипты — иначе зелёный ничего не значит", () => {
    expect(Object.keys(scripts).length).toBeGreaterThan(10);
  });

  for (const { file, command, why } of MUST_BE_CALLABLE) {
    test(`${file} вызывается как npm run ${command} — ${why}`, () => {
      // Файл на месте.
      expect(() => readFileSync(join(SCRIPTS_DIR, file), "utf8"), `нет файла scripts/${file}`).not.toThrow();
      // И команда на месте, и ведёт именно на этот файл: запись, потерявшая
      // связь с файлом, ничем не лучше отсутствующей.
      const cmd = scripts[command];
      expect(cmd, `в package.json нет команды "${command}" — скрипт остался сиротой`).toBeTruthy();
      expect(cmd, `команда "${command}" не ссылается на scripts/${file}`).toContain(file);
    });
  }

  test("список снапшотов вызывается тоже — иначе о наличии копий не узнать", () => {
    expect(scripts["backup:list"], 'нет команды "backup:list"').toBeTruthy();
    expect(scripts["backup:list"]).toContain("restore.mjs");
  });
});
