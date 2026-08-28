import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * Отметку сборки читает ОДИН помощник, и переменная окружения — только его
 * запасной путь.
 *
 * Замер 27.08.2026: `routes/qreal.ts` заполнял health-поле `commit` прямо из
 * `RAILWAY_GIT_COMMIT_SHA`. Выкатка идёт папкой, эта переменная не ставится —
 * поле было `null` ВСЕГДА, и `qreal-prod-smoke` краснел на нём постоянно:
 * единственный красный на 59 смоуков прода. Свип с вечным одним отказом
 * перестают читать целиком.
 *
 * Почему именно файл, а не переменная (это уже стоило прода 14.08.2026):
 * переменные принадлежат СЕРВИСУ, а не образу. Отметка переживала выкатку и
 * уверенно называла чужой коммит — хуже, чем честное «не знаю».
 */

const SRC = join(__dirname, "..", "src");
const read = (p: string) => stripComments(readFileSync(join(SRC, p), "utf8"));

// Порядок «файл раньше переменной» стережёт tests/buildStampPrefersFile —
// он написан раньше и делает это подробнее. Здесь только то, чего там нет:
// что читатель ОДИН и что qreal подключён именно к нему.
describe("отметку сборки читает один помощник", () => {
  test("контроль: файлы на месте", () => {
    expect(read("lib/buildInfo.ts")).toContain("export function readBuildInfo");
    expect(read("routes/qreal.ts").length).toBeGreaterThan(1000);
  });

  test("никто, кроме общего помощника, не читает переменную коммита", () => {
    // Именно эта переменная и создавала расхождение: один модуль отвечал
    // «не знаю», другой — настоящим коммитом, и оба выглядели правдиво.
    const offenders: string[] = [];
    for (const f of ["routes/qreal.ts", "index.ts"]) {
      if (read(f).includes("RAILWAY_GIT_COMMIT_SHA")) offenders.push(f);
    }
    expect(offenders, "переменная читается в обход общего помощника").toEqual([]);
  });

  test("qreal отдаёт коммит через общий помощник, а не сам", () => {
    const src = read("routes/qreal.ts");
    expect(src, "qreal не подключён к общему читателю").toContain("readBuildInfo");
    expect(src, "«unknown» не должно уезжать в ответ как коммит").toContain('"unknown"');
  });
});
