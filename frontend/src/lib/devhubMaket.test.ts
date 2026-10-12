import { describe, it, expect } from "vitest";
import {
  maketRabochegoOkna,
  shirinaRabochejOblasti,
  УЗКИЙ_ЭКРАН_PX,
  ШИРИНА_ДЕРЕВА_PX,
} from "./devhubMaket";

/**
 * Сторож на замеренный дефект: на 390×844 превью занимало 115 px из 390,
 * потому что дерево файлов держало 260 px рядом. Здесь проверяется ровно
 * то свойство, которого не хватало человеку: на телефоне рабочая область
 * получает ВСЮ ширину окна, а на широком окне ничего не меняется.
 */
describe("раскладка рабочего окна DevHub", () => {
  it("на телефоне 390 рабочая область — вся ширина окна, а не 130 px", () => {
    const m = maketRabochegoOkna(390);
    expect(m.другПодДругом).toBe(true);
    expect(m.ширинаДерева).toBe("100%");
    expect(m.границаДереваСнизу).toBe(true);
    expect(shirinaRabochejOblasti(390)).toBe(390);
    // именно это число было на проде до правки — оно не должно вернуться
    expect(shirinaRabochejOblasti(390)).not.toBe(390 - ШИРИНА_ДЕРЕВА_PX);
  });

  it("на 1463 всё как было: дерево 260 рядом, рабочей области 1203", () => {
    const m = maketRabochegoOkna(1463);
    expect(m.другПодДругом).toBe(false);
    expect(m.ширинаДерева).toBe(ШИРИНА_ДЕРЕВА_PX);
    expect(m.границаДереваСнизу).toBe(false);
    expect(shirinaRabochejOblasti(1463)).toBe(1463 - ШИРИНА_ДЕРЕВА_PX);
  });

  it("порог ровно 769: 768 — узкий, 769 — широкий", () => {
    expect(maketRabochegoOkna(УЗКИЙ_ЭКРАН_PX - 1).другПодДругом).toBe(true);
    expect(maketRabochegoOkna(УЗКИЙ_ЭКРАН_PX).другПодДругом).toBe(false);
  });

  it("пары экранов, на которых принимают: узкие дают всю ширину, широкие — за вычетом дерева", () => {
    const пары: Array<[number, boolean]> = [
      [390, true],
      [540, true],
      [768, true],
      [1024, false],
      [1463, false],
    ];
    for (const [ширина, ожидаемУзкий] of пары) {
      expect(maketRabochegoOkna(ширина).другПодДругом, `окно ${ширина}`).toBe(ожидаемУзкий);
      expect(shirinaRabochejOblasti(ширина), `окно ${ширина}`).toBe(
        ожидаемУзкий ? ширина : ширина - ШИРИНА_ДЕРЕВА_PX,
      );
    }
    expect(пары.length).toBe(5); // знаменатель: проверено 5 пар из 5
  });

  it("рабочая область никогда не уже половины окна — то, из-за чего правка и делалась", () => {
    for (const ш of [320, 390, 414, 540, 768, 820, 1024, 1280, 1463]) {
      expect(shirinaRabochejOblasti(ш) / ш, `окно ${ш}`).toBeGreaterThanOrEqual(0.5);
    }
  });
});
