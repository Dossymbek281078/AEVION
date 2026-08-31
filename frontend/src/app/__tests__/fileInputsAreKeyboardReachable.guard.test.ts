import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Поле выбора файла, спрятанное через display:none, ВЫПАДАЕТ из обхода Tab:
 * человек без мыши нажать его не может вовсе. Замер 31.08.2026 — девять таких
 * полей на девяти страницах, включая «Восстановить из файла» в QRight.
 *
 * Законных способов спрятать поле два, и оба остаются доступными:
 *   1) className="aevion-file-input" — спрятано визуально, в обходе остаётся;
 *   2) display:none ПЛЮС кнопка рядом, дергающая поле программно (.click()).
 *
 * Сторож запрещает третий: спрятать насмерть и оставить только подпись,
 * которую с клавиатуры не нажать.
 */

const КОРЕНЬ = path.join(__dirname, "..");
const ФОРМЫ_СОКРЫТИЯ = ['style={{ display: "none" }}', 'className="hidden"'];

function файлы(дир: string, найдено: string[] = []): string[] {
  for (const имя of fs.readdirSync(дир)) {
    const п = path.join(дир, имя);
    const st = fs.statSync(п);
    if (st.isDirectory()) {
      if (имя !== "node_modules" && имяОк(имя)) файлы(п, найдено);
    } else if (имя.endsWith(".tsx")) найдено.push(п);
  }
  return найдено;
}
const имяОк = (имя: string) => имя !== "__tests__";

/** Поля файла, спрятанные насмерть и обёрнутые только подписью. */
export function недостижимыеПоляФайла(исходники: { путь: string; текст: string }[]) {
  const находки: string[] = [];
  for (const { путь, текст } of исходники) {
    let i = 0;
    for (;;) {
      i = текст.indexOf('type="file"', i);
      if (i < 0) break;
      const нач = текст.lastIndexOf("<input", i);
      const кон = текст.indexOf("/>", i);
      if (кон < 0) break;
      const тег = нач >= 0 ? текст.slice(нач, кон) : "";
      const спрятано = ФОРМЫ_СОКРЫТИЯ.some((ф) => тег.includes(ф));
      // подпись оборачивает поле, если открывающий <label ближе, чем последний </label>
      const подпись = текст.lastIndexOf("<label", нач) > текст.lastIndexOf("</label>", нач);
      // кнопка рядом дергает поле программно — тогда клавиатура работает
      const окно = текст.slice(Math.max(0, нач - 2500), нач + 2500);
      if (спрятано && подпись && !окно.includes(".click()")) {
        находки.push(путь + " :" + (текст.slice(0, нач).split("\n").length));
      }
      i = кон;
    }
  }
  return находки;
}

describe("поле выбора файла достижимо с клавиатуры", () => {
  const исходники = файлы(КОРЕНЬ).map((п) => ({
    путь: path.relative(КОРЕНЬ, п).split(path.sep).join("/"),
    текст: fs.readFileSync(п, "utf8"),
  }));

  it("прибор умеет находить: на заведомо плохом образце даёт находку", () => {
    const плохой = [{
      путь: "образец.tsx",
      текст: '<label>Выбрать<input type="file" style={{ display: "none" }} /></label>',
    }];
    expect(недостижимыеПоляФайла(плохой)).toHaveLength(1);
  });

  it("прибор не клевещет: поле с кнопкой-триггером находкой не считает", () => {
    const хороший = [{
      путь: "образец.tsx",
      текст: '<button onClick={() => ref.current?.click()}>Выбрать</button>'
        + '<label><input type="file" style={{ display: "none" }} /></label>',
    }];
    expect(недостижимыеПоляФайла(хороший)).toHaveLength(0);
  });

  it("сборка читается: файлов со страницами найдено достаточно", () => {
    expect(исходники.length).toBeGreaterThan(200);
  });

  it("ни одно поле выбора файла не спрятано насмерть под подписью", () => {
    expect(недостижимыеПоляФайла(исходники)).toEqual([]);
  });
});
