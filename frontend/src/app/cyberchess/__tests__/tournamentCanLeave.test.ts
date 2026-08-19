import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Из турнира можно выйти, и это видно человеку. 19.08.2026.
//
// Ручка отмены появилась на бэкенде в тот же день, но ручка без кнопки — это
// ручка без потребителя: возможность есть, а воспользоваться ей нельзя. У нас
// уже был этот класс, поэтому проверка стоит рядом с самой кнопкой.
//
// Записался — значит навсегда: это про согласие человека, а не про удобство.

const SRC = path.join(__dirname, "..", "tournaments", "[id]", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8"));

describe("участие можно отменить", () => {
  test("кнопка отмены есть и вызывает обработчик", () => {
    const s = src();
    expect(s).toMatch(/Отменить участие/);
    expect(s).toMatch(/onClick=\{onUnregister\}/);
  });

  test("запрос идёт на ручку отмены и несёт билет", () => {
    const s = src();
    const call = s.split("/unregister")[1]?.slice(0, 500) ?? "";
    expect(s).toMatch(/unregister/);
    // Билет — доказательство права: без него вычеркнуть человека мог бы любой,
    // кто знает его идентификатор.
    expect(call).toMatch(/ticketId/);
  });

  test("отказ показывается отказом, а не молчаливым возвратом", () => {
    // Иначе человек решит, что вышел, и не придёт на турнир, где числится.
    const s = src();
    const h = s.split("handleUnregister")[1]?.slice(0, 900) ?? "";
    expect(h).toMatch(/phase: "error"/);
  });
});
