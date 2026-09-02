import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ccPlural } from "../ccPlural";

/**
 * Имена продуктов уходили живому переводчику на КАЖДОМ заходе. На главной
 * это закрыли 01.09, а 02.09 замер на экране АНАЛИЗА показал три отправки
 * «Chessy» — из подписей кнопки дока (title и aria-label).
 *
 * Цена: платный вызов на каждом заходе плюс риск, что модель однажды
 * вернёт «Чесси» и бренд сменится на экране сам собой.
 */

describe("имя продукта и склонение", () => {
  it("кнопка дока с именем продукта помечена «не переводить»", () => {
    const док = readFileSync(join(__dirname, "..", "WorkspaceDock.tsx"), "utf8");
    expect(док).toContain('label: "Chessy", imya: true');
    expect(док).toContain('translate={s.imya ? "no" : undefined}');
    // и класс тоже: сборщик строк смотрит оба признака
    expect(док).toContain('className={s.imya ? "notranslate" : undefined}');
  });

  it("русские подписи дока переводить МОЖНО — метка стоит только у имени", () => {
    const док = readFileSync(join(__dirname, "..", "WorkspaceDock.tsx"), "utf8");
    // контроль: пометка не расползлась на «Задача дня», «Заметки» и прочие,
    // иначе англоязычный посетитель увидит русские подписи
    expect((док.match(/imya: true/g) || []).length).toBe(1);
  });

  it("«N ходов» склоняется, а не пишется одной формой", () => {
    expect(ccPlural(1, "ход", "хода", "ходов")).toBe("ход");
    expect(ccPlural(4, "ход", "хода", "ходов")).toBe("хода");
    expect(ccPlural(11, "ход", "хода", "ходов")).toBe("ходов");
    const код = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    expect(код, "у графика оценки была жёсткая форма «4 ходов»")
      .toContain('{analysis.length} {ccPlural(analysis.length,"ход","хода","ходов")}');
  });
});
