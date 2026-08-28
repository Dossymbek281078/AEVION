import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"), "utf8");

/**
 * У пустой очереди должен быть выход, а не только «попробуй ещё раз».
 *
 * 30 августа соперников почти не будет: пул игроков начинается с нуля. Экран
 * честно говорит «возможно, нет соперников с похожим рейтингом» — но
 * единственная кнопка возвращает в ту же очередь. Человек, пришедший играть,
 * уходит ни с чем, хотя партия против движка работает и доступна сразу.
 */
describe("ожидание соперника не заканчивается тупиком", () => {
  test("в состоянии ошибки предлагается партия с движком", () => {
    const at = SRC.indexOf('state.phase === "error"');
    expect(at, "блок ошибки не найден — проверь тест").toBeGreaterThan(-1);
    const block = SRC.slice(at, at + 1200);
    expect(block, "нет выхода к движку: остаётся только «попробовать снова»").toContain("Сыграть с движком");
    expect(block).toContain('href="/cyberchess"');
  });

  test("честное объяснение про отсутствие соперников осталось", () => {
    // Выход к движку не должен подменить причину: человеку по-прежнему надо
    // сказать, ПОЧЕМУ никого нет.
    expect(SRC).toContain("нет соперников с похожим рейтингом");
  });
});
