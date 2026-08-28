import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// В ДЕНЬ запуска страница не должна говорить «не хотите ждать» и «пока идёт
// подготовка»: ждать уже нечего, подготовка кончилась. Найдено 29.08.2026,
// накануне запуска: оба текста были безусловными и стали бы ложью ровно в тот
// день, когда страница нужнее всего.
describe("страница запуска в день запуска зовёт играть", () => {
  const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

  it("тексты ожидания стоят под условием left > 0", () => {
    for (const phrase of ["Не хотите ждать", "Пока идёт подготовка"]) {
      const at = src.indexOf(phrase);
      expect(at, `фразы «${phrase}» нет вовсе — проверка потеряла предмет`).toBeGreaterThan(0);
      // Условие обязано стоять в пределах строки-обёртки перед фразой.
      const before = src.slice(Math.max(0, at - 220), at);
      expect(before, `«${phrase}» напечатается и в день запуска`).toContain("left > 0");
    }
  });

  it("в день запуска есть прямой призыв играть", () => {
    expect(src).toContain("играть прямо сейчас");
    expect(src).toContain("Играть можно прямо сейчас");
  });
});
