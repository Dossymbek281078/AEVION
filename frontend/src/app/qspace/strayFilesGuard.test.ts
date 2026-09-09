import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * В корне `frontend/src` не должно появляться посторонних файлов.
 *
 * Повод не гипотетический: 8 и 9 сентября в этот каталог дважды приходили
 * файлы соседнего окна (`eml.mjs`, `reminders.mjs`, затем `mark-sent.mjs`,
 * `extract.mjs`) — его обход мутаций работал по пути в ЧУЖУЮ рабочую копию.
 * Опасность двойная: автосейв коммитит раз в 30 минут и уносит чужое в мою
 * ветку как моё, а при переключении ветки чужая работа может пропасть молча.
 *
 * Почему проверка, а не наблюдение. Я отчитался «сейчас .mjs здесь ноль» —
 * и это доказывает ровно момент замера. Соседнее окно (QRemix) справедливо
 * заметило: устойчиво только то, что проверяется само. Теперь чужой файл
 * виден на первом же прогоне, а не через сутки.
 *
 * Проверка живёт в модуле QSpace, хотя стережёт весь `frontend/src`: она
 * ничего не знает о 3D, но именно этот набор гоняется здесь чаще всего.
 */
const SRC = path.resolve(__dirname, "..", "..");

/** Что в корне `src` лежит законно. Каталоги не в счёт — их проверяет Next. */
const РАЗРЕШЕНО = new Set(["instrumentation.ts", "vitest-globals.d.ts"]);

function лишниеФайлы(каталог: string): string[] {
  return readdirSync(каталог, { withFileTypes: true })
    .filter((d) => d.isFile() && !РАЗРЕШЕНО.has(d.name))
    .map((d) => d.name)
    .sort();
}

describe("в корне frontend/src нет посторонних файлов", () => {
  it("ни одного файла сверх разрешённых", () => {
    expect(
      лишниеФайлы(SRC),
      "в корне src появился файл, которого там быть не должно — скорее всего "
      + "он от соседнего окна: не коммитить, найти владельца, копию сохранить",
    ).toEqual([]);
  });

  it("контроль прибора: подложенный файл НАХОДИТСЯ", () => {
    // без этого «лишних нет» неотличимо от «проверка ничего не умеет искать»
    const врем = mkdtempSync(path.join(tmpdir(), "qspace-stray-"));
    try {
      writeFileSync(path.join(врем, "instrumentation.ts"), "");
      writeFileSync(path.join(врем, "чужой.mjs"), "");
      expect(лишниеФайлы(врем)).toEqual(["чужой.mjs"]);
    } finally {
      rmSync(врем, { recursive: true, force: true });
    }
  });

  it("контроль прибора: SRC указывает именно на корень src", () => {
    // Самый тихий способ для такого сторожа ослепнуть — смотреть не туда:
    // пустой или чужой каталог даст ровный ноль, и зелёный цвет будет означать
    // «не смотрел», а не «чисто».
    const есть = readdirSync(SRC, { withFileTypes: true });
    expect(есть.some((d) => d.isFile() && d.name === "instrumentation.ts"),
      "SRC смотрит не на frontend/src — проверка ничего не стережёт").toBe(true);
    expect(есть.some((d) => d.isDirectory() && d.name === "app"),
      "в SRC нет каталога app — это не корень исходников").toBe(true);
  });

  it("контроль прибора: каталоги лишними не считаются", () => {
    // иначе сторож краснел бы на app/, lib/ и был бы выключен в первый день
    expect(лишниеФайлы(SRC).filter((n) => n === "app" || n === "lib")).toEqual([]);
  });
});
