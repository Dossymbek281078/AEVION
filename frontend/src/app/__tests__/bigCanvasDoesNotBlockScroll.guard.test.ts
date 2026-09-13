import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Крупный холст не имеет права останавливать прокрутку страницы.
 *
 * `touchAction: "none"` означает «все касания мои». Для маленькой ручки
 * перетаскивания это верно и нужно. Для холста ВО ВСЮ ШИРИНУ это ловушка: на
 * телефоне палец, попавший в эту полосу, страницу не листает — человек
 * упирается и уходит, считая её сломанной.
 *
 * Найдено 13.09.2026 у глобуса на ГЛАВНОЙ (`Globus3D.tsx`, холст `width: 100%`).
 * Класс принесло соседнее окно, у себя они замерили его с контролем: свайп по
 * холсту 978 -> 978, свайп рядом 978 -> 1183.
 *
 * Лечение — `pan-y`: вертикаль уходит браузеру (прокрутка), горизонталь
 * остаётся элементу (поворот). Размен назван вслух в самом файле.
 *
 * ⚠️ Граница честная: это проверка ИСХОДНИКА. Она не докажет, что палец листает
 * страницу, — это проверяется браузером. Она стережёт возврат «none» туда,
 * откуда его убрали, и появление его в новых широких холстах.
 */

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Места, где «все касания мои» ЗАКОННО: маленькие ручки перетаскивания и
 * изменения размера. Список обязан только СОКРАЩАТЬСЯ — сторож краснеет и
 * когда появляется новое место, и когда запись перестала быть правдой.
 */
const RAZRESHENO = [
  "cyberchess/StreamerOverlay.tsx",
  "cyberchess/WorkspacePiP.tsx",
];

function vseFajly(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === "__tests__") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) vseFajly(p, out);
    else if (e.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("широкий холст не съедает прокрутку страницы", () => {
  const files = vseFajly(APP);

  it("контроль: обход нашёл страницы", () => {
    expect(files.length, "обход пуст — сторож проверял бы ничто").toBeGreaterThan(100);
  });

  it("touchAction none только там, где это ручка перетаскивания", () => {
    const najdeno: string[] = [];
    for (const f of files) {
      // Комментарии вырезаются, иначе сторож краснеет на ИСПРАВНОМ коде.
      // 13.09.2026: qspace/_client.tsx поставил себе pan-y и рядом объяснил
      // ПОЧЕМУ — процитировав «touchAction: "none"» как поведение библиотеки
      // OrbitControls. Сторож прочитал цитату как признак и поднял тревогу на
      // файле, который как раз дефект и закрыл. Текст О вещи неотличим от
      // вещи для любого разбора по образцу.
      const исходник = readFileSync(f, "utf8")
        .split(/\r?\n/)
        .filter((строка) => !/^\s*\/\//.test(строка))
        .join(String.fromCharCode(10));
      if (!исходник.includes('touchAction: "none"')) continue;
      najdeno.push(f.slice(APP.length + 1).split(String.fromCharCode(92)).join("/"));
    }
    const novye = najdeno.filter((f) => !RAZRESHENO.includes(f));
    expect(
      novye,
      "холст с «все касания мои» вне списка ручек: на телефоне он остановит прокрутку — " +
        novye.join(", "),
    ).toEqual([]);

    const ischezli = RAZRESHENO.filter((f) => !najdeno.includes(f));
    expect(ischezli, "уже не правда — вычеркните из списка: " + ischezli.join(", ")).toEqual([]);
  });

  it("глобус на главной отдаёт вертикаль прокрутке", () => {
    const t = readFileSync(join(APP, "components", "Globus3D.tsx"), "utf8");
    expect(t, "у холста глобуса нет pan-y — вернулось «все касания мои»").toContain(
      'touchAction: "pan-y"',
    );
  });
});
