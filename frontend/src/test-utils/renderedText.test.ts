import { describe, it, expect } from "vitest";
import {
  sobratVidimyj,
  angliyskieStroki,
  tolkoLatinica,
  ostalosLatinskoeSlovo,
  pohozheNaZnachenie,
  TERMINY_OBSHIE,
} from "./renderedText";

/**
 * Проверка САМОГО помощника, а не страниц.
 *
 * Помощник читают несколько сторожей; если бы каждый проверял его поведение у
 * себя, контроль размножился бы вместе с логикой — а размноженный контроль
 * расходится. Здесь он один, и мутации по сборщику ловятся независимо от того,
 * какая страница его использует.
 *
 * Три дыры, которые эти проверки закрывают (все вскрыты мутацией 03.09.2026,
 * ни одна — чтением):
 *   сбор текста отключён   -> сторож зелёный на пустоте;
 *   сбор АТРИБУТОВ отключён -> текстовых узлов хватает на общий порог, а
 *                              подписи для читалки выпадают целиком;
 *   правило всегда false    -> находок нет никогда, охват при этом в норме.
 */

function razmetka(html: string): Element {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("сборщик видимого текста", () => {
  it("берёт текстовые узлы", () => {
    const v = sobratVidimyj(razmetka("<p>Привет</p><span>мир</span>"));
    expect(v.tekst).toEqual(["Привет", "мир"]);
  });

  it("берёт подписывающие атрибуты — все четыре", () => {
    const v = sobratVidimyj(
      razmetka(
        '<input aria-label="Имя" placeholder="Введите" />' +
          '<img alt="Схема" /><button title="Закрыть">x</button>',
      ),
    );
    expect(v.atributy.sort()).toEqual(["Введите", "Закрыть", "Имя", "Схема"]);
  });

  it("текст и атрибуты собираются РАЗДЕЛЬНО", () => {
    // Ради этого разделения помощник и написан так: при общем счёте отключение
    // сбора атрибутов проходит молча.
    const v = sobratVidimyj(razmetka('<p>текст</p><input aria-label="подпись" />'));
    expect(v.tekst).toEqual(["текст"]);
    expect(v.atributy).toEqual(["подпись"]);
    expect(v.vsyo.length).toBe(2);
  });

  it("содержимое <style> и <script> НЕ считается видимым текстом", () => {
    // Иначе правила оформления попадают в список английских надписей —
    // на первой же странице так и вышло: «@keyframes pulse-dot {…}».
    const v = sobratVidimyj(
      razmetka("<style>.a { color: red; }</style><script>var x = 1;</script><p>Видно</p>"),
    );
    expect(v.tekst).toEqual(["Видно"]);
  });

  it("пустая разметка даёт пустой сбор, а не выдумку", () => {
    const v = sobratVidimyj(razmetka("<div></div>"));
    expect(v.vsyo).toEqual([]);
  });
});

describe("правило «только латиница»", () => {
  it("английское распознаёт, русское и смешанное — нет", () => {
    expect(tolkoLatinica("Upload deck")).toBe(true);
    expect(tolkoLatinica("Загрузить")).toBe(false);
    expect(tolkoLatinica("QVenture — разбор")).toBe(false);
    // Строка без букв вообще не должна считаться английской.
    expect(tolkoLatinica("2026-09-04")).toBe(false);
  });

  it("термины отсеиваются, настоящее остаётся", () => {
    expect(ostalosLatinskoeSlovo("AEVION API", TERMINY_OBSHIE)).toBe(false);
    expect(ostalosLatinskoeSlovo("Upload failed", TERMINY_OBSHIE)).toBe(true);
  });
});

describe("значение против подписи", () => {
  it("адреса, файлы и числа с единицей — значения", () => {
    for (const z of ["https://proba.pages.dev", "build-d1.log", "0ms", "40%", "2026-09-04"]) {
      expect(pohozheNaZnachenie(z), z + " принято за подпись").toBe(true);
    }
  });

  it("ОДНОСЛОВНЫЕ подписи значениями НЕ считаются", () => {
    // Правило «без пробела — не подпись» ослепило соседнего сторожа именно
    // здесь: Building и Pending — это подписи состояний, а не значения.
    for (const p of ["Building", "Pending", "Failed", "Loading"]) {
      expect(pohozheNaZnachenie(p), p + " ошибочно принято за значение").toBe(false);
    }
  });
});

describe("поиск английских строк", () => {
  it("находит английское и пропускает русское и термины", () => {
    const v = sobratVidimyj(
      razmetka('<p>Загрузить</p><p>Upload deck</p><p>AEVION</p><p>Upload deck</p>'),
    );
    // Повтор схлопывается: список для человека, а не счётчик.
    expect(angliyskieStroki(v)).toEqual(["Upload deck"]);
  });

  it("на чисто русской разметке находок НЕТ", () => {
    const v = sobratVidimyj(razmetka("<p>Всё по-русски</p><p>И это тоже</p>"));
    expect(angliyskieStroki(v)).toEqual([]);
  });
});
