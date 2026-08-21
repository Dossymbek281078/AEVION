import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Страница не принимает нерешаемую задачу. 19.08.2026.
//
// Сервер отдавал `sol: ["[\"c5c3\"", "\"e6e4\""]` — массив обрывков JSON. Здешняя
// проверка смотрела только `Array.isArray`, массив был, и мусор проезжал внутрь.
// Движок на этой странице сравнивает ход игрока с этим списком: совпадения нет
// никогда, задача не решается, и НИ ОДНОЙ ошибки на экране при этом нет.
//
// Проверка на стороне потребителя нужна отдельно от серверной: сервер чинится
// выкаткой, а страница живёт у человека в браузере и должна пережить регрессию
// на той стороне честной резервной задачей, а не молчаливой неработоспособностью.

const SRC = path.join(__dirname, "..", "daily", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8"));

describe("задача с негодными ходами не принимается", () => {
  test("формат хода проверяется, а не только тип поля", () => {
    const s = src();
    // Проверка именно UCI-записи: e2e4 и превращение g7g8q.
    expect(s).toMatch(/\[a-h\]\[1-8\]\[a-h\]\[1-8\]\[qrbn\]\?/);
  });

  test("проверка стоит до применения задачи, а не после", () => {
    const s = src();
    const guard = s.search(/\[a-h\]\[1-8\]\[a-h\]\[1-8\]\[qrbn\]\?/);
    const apply = s.indexOf("setPuzzle({");
    expect(guard).toBeGreaterThan(-1);
    expect(apply).toBeGreaterThan(-1);
    // Иначе негодная задача успела бы стать текущей и сбросить состояние.
    expect(guard).toBeLessThan(apply);
  });
});
