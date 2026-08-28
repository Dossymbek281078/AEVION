import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * Удаление не считается сделанным, пока сервер не ответил.
 *
 * Свип 21.08.2026: 11 мест на фронте убирали запись С ЭКРАНА сразу после
 * запроса DELETE, не глядя на ответ, а ошибку часто глотали («// ignore»,
 * «/* silent *\/»). Провал удаления выглядел как удаление — и это хуже пустого
 * списка: пустоту заметно, мнимый успех нет. Человек уходит, считая дело
 * сделанным.
 *
 * Проверка идёт по ПОРЯДКУ строк внутри функции, а не по наличию `.ok` в файле:
 * первая версия такого теста осталась зелёной на мутации, потому что `.ok`
 * встречается в файле много где.
 */

const ROOT = join(__dirname, "..");

const CASES: Array<[string, string, string]> = [
  ["QCoreAI закладки", "qcoreai/bookmarks/page.tsx", "removeBookmark"],
  ["QCoreAI цепочки", "qcoreai/chains/page.tsx", "deleteChain"],
  ["QCoreAI конвейеры", "qcoreai/pipeline/page.tsx", "del"],
  ["QSocial запись", "qsocial/page.tsx", "handleDelete"],
  ["QCoreAI A/B-тесты", "qcoreai/ab-tests/page.tsx", "deleteTest"],
  ["QCoreAI заметки", "qcoreai/notebook/page.tsx", "del"],
  ["QCoreAI расписания", "qcoreai/schedule/page.tsx", "remove"],
];

describe("удаление проверяет ответ до правки экрана", () => {
  test.each(CASES)("%s", (_name, file, fnName) => {
    const lines = stripComments(readFileSync(join(ROOT, file), "utf8")).split(
      String.fromCharCode(10),
    );
    // Объявления бывают трёх видов: function X(, const X = async (, async X(.
    // Первая версия искала только «X(» рядом с «async» и не находила стрелочные —
    // тест краснел «функция не найдена» там, где функция есть.
    const start = lines.findIndex((l) => {
      const t = l.trim();
      return (
        t.startsWith(`function ${fnName}(`) ||
        t.startsWith(`async function ${fnName}(`) ||
        t.startsWith(`const ${fnName} = async`) ||
        t.startsWith(`const ${fnName} = (`) ||
        t.startsWith(`async ${fnName}(`)
      );
    });
    // Контроль: функция найдена. Иначе при переименовании проверка стала бы
    // проверять пустоту и молча зеленеть.
    expect(start, `функция ${fnName} не найдена в ${file}`).toBeGreaterThan(-1);

    const body = lines.slice(start, start + 20);
    const okAt = body.findIndex((l) => l.includes("!r.ok") || l.includes("res.ok"));
    const removeAt = body.findIndex((l) => l.includes(".filter("));

    expect(okAt, "ответ сервера не проверяется").toBeGreaterThan(-1);
    expect(removeAt, "удаление из списка не найдено").toBeGreaterThan(-1);
    expect(okAt, "запись убирается с экрана ДО ответа сервера").toBeLessThan(removeAt);
  });

  test("контроль: молчит ли catch ИМЕННО в функциях удаления", () => {
    // Проверка нарочно узкая. Молчаливый catch сам по себе не дефект: рядом в
    // qsocial есть чтение бесед, где ошибка глотается, но список НЕ обнуляется —
    // прежнее состояние остаётся, и это законно. Дефект — когда молчание
    // сопровождает изменение экрана.
    for (const [, file, fnName] of CASES) {
      const lines = stripComments(readFileSync(join(ROOT, file), "utf8")).split(
        String.fromCharCode(10),
      );
      const start = lines.findIndex((l) => l.trim().includes(fnName));
      const body = lines.slice(start, start + 20).join(String.fromCharCode(10));
      const silent = /catch\s*\{\s*\}/.test(body);
      expect(silent, `${file}: отказ удаления снова без следа`).toBe(false);
    }
  });
});
