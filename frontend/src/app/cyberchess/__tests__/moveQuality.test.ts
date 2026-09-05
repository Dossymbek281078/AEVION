import { describe, expect, test } from "vitest";
import { classifyDrop, nonPawnMaterialFromFEN } from "../moveQuality";

/**
 * Ярлык качества хода человек видит после каждого своего хода. При поломке
 * ничего не падает — разбор просто начинает льстить или ругать зря.
 *
 * Проверяем СВОЙСТВА, а не конкретные числа порогов: числа авторы вправе
 * подкручивать, а вот «потерял ферзя — значит зевок» меняться не должно.
 *
 * Мутационно проверено 28.08.2026.
 */
const NACHALO = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ENDSHPIL = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";

describe("качество хода", () => {
  test("крупная потеря — это зевок", () => {
    expect(classifyDrop(500, 0, -500, NACHALO)).toBe("blunder");
  });

  test("хороший ход не объявляется ошибкой", () => {
    expect(classifyDrop(5, 0, -5, NACHALO)).toBe("good");
  });

  test("ярлыки идут по возрастанию тяжести, а не вперемешку", () => {
    const p = (d: number) => classifyDrop(d, 0, 0, NACHALO);
    expect(p(10)).toBe("good");
    expect(p(100)).toBe("inacc");
    expect(p(200)).toBe("mistake");
    expect(p(400)).toBe("blunder");
  });

  test("в эндшпиле та же потеря судится строже, чем в дебюте", () => {
    // Значение подобрано так, чтобы ярлыки РАЗЛИЧАЛИСЬ: в дебюте потеря ещё
    // терпимая, в голом эндшпиле та же цифра значит больше. Сравнение «не мягче»
    // тут не годится — оно проходит и когда зависимости от стадии нет вовсе
    // (проверено мутацией: убрал фазовый множитель, тест остался зелёным).
    const vNachale = classifyDrop(50, 0, 0, NACHALO);
    const vEndshpile = classifyDrop(50, 0, 0, ENDSHPIL);
    expect(vNachale).toBe("good");
    expect(vEndshpile).toBe("inacc");
  });

  test("в уже проигранной позиции та же потеря судится мягче", () => {
    const rovno = classifyDrop(200, 0, -200, NACHALO);
    const uzheProigral = classifyDrop(200, -600, -800, NACHALO);
    const tyazhest = ["good", "inacc", "mistake", "blunder"];
    expect(tyazhest.indexOf(uzheProigral)).toBeLessThan(tyazhest.indexOf(rovno));
  });

  test("ход, улучшивший позицию, получает похвалу, а не порицание", () => {
    // Две ветви похвалы проверяем ОТДЕЛЬНО: пока стоял общий список из двух
    // ярлыков, ветвь «great» не проверялась вовсе — мутация её отключения
    // проходила незамеченной.
    expect(classifyDrop(-120, 0, 120, NACHALO)).toBe("brilliant");
    expect(classifyDrop(-60, 0, 60, NACHALO)).toBe("great");
  });

  test("материал без пешек считается верно", () => {
    expect(nonPawnMaterialFromFEN(NACHALO)).toBe(62); // полный комплект
    expect(nonPawnMaterialFromFEN(ENDSHPIL)).toBe(0); // только короли и пешка
    expect(nonPawnMaterialFromFEN(undefined)).toBe(62); // нет данных — считаем как полный
  });
});
