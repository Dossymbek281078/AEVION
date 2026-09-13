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
      // ДВЕ формы записи, и вторая чуть не осталась слепой зоной. В объекте
      // стилей пишут `touchAction: "none"` (двоеточие), а на живом элементе —
      // `canvas.style.touchAction = "none"` (равно). Соседнее окно поймало это
      // у себя: их сторож знал только первую форму и потому был зелёным ровно
      // там, где дефект и жил. Комментарии вырезаем: цитата формы в пояснении
      // иначе краснит сторожа на исправном коде — этот класс у нас уже был.
      const tekst = readFileSync(f, "utf8")
        .split(String.fromCharCode(10))
        .filter((l) => !l.trim().startsWith("//"))
        .join(String.fromCharCode(10));
      const zapret =
        tekst.includes('touchAction: "none"') || tekst.includes('touchAction = "none"');
      if (!zapret) continue;
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
