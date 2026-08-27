import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Кнопка, которая на самом деле не кнопка: `<span>` или `<div>` с onClick.
 *
 * Три последствия, ни одно из которых не видно на скриншоте:
 *  - с клавиатуры элемент недостижим (на Tab не попадает, Enter не работает);
 *  - экранный диктор объявляет его текстом, а не кнопкой;
 *  - подсказка о том, что он нажимается, обычно живёт в `title`, а `title`
 *    показывается по наведению мыши — то есть на телефоне не существует.
 *
 * Найдено 19.08.2026 на своей же странице: проверка подписи двойника —
 * главное действие блока доверия — была кликабельным текстом.
 *
 * ОБЛАСТЬ НАМЕРЕННО УЗКАЯ. Замер по всей платформе дал 116 таких мест в
 * 67 файлах, больше всего в CyberChess (19). Сторож, поставленный на всё
 * дерево, краснел бы на каждой чужой ветке и был бы отключён в первый же
 * день — эти грабли платформа уже проходила. Поэтому здесь только страницы,
 * приведённые в порядок; владелец любой другой добавляет свою строкой ниже.
 */
const GUARDED = ["qskyway"];

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else if (p.endsWith(".tsx") || p.endsWith(".jsx")) out.push(p);
  }
  return out;
}

const NON_INTERACTIVE = new Set([
  "span", "div", "p", "li", "td", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
]);

type Tag = { name: string; attrs: string; end: number };

/**
 * Разбор со СЧЁТОМ скобок, а не регуляркой. Это не педантизм: 19.08.2026
 * две регулярки подряд дали 157 и 126 вместо 116, и оба числа выглядели
 * правдоподобно. Первая втягивала в атрибуты вложенную `<button onClick>`
 * и приписывала её обработчик родителю; вторая обрывала разбор на
 * `style={{…}}` из-за вложенных скобок. Атрибуты JSX — вложенный синтаксис,
 * регулярка его не разбирает в принципе, но и не падает: она молча возвращает
 * неверное число.
 */
function tagAt(src: string, i: number): Tag | null {
  let j = i + 1;
  while (j < src.length && /[a-zA-Z0-9]/.test(src[j])) j++;
  const name = src.slice(i + 1, j);
  if (!NON_INTERACTIVE.has(name)) return null;

  let depth = 0;
  let quote: string | null = null;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (quote) {
      if (c === quote && src[k - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return { name, attrs: src.slice(j, k), end: k + 1 };
  }
  return null;
}

/** onClick САМОГО элемента — на верхнем уровне атрибутов, не внутри выражения. */
function hasOwnOnClick(attrs: string): boolean {
  let depth = 0;
  for (let k = 0; k < attrs.length; k++) {
    if (attrs[k] === "{") depth++;
    else if (attrs[k] === "}") depth--;
    else if (depth === 0 && attrs.startsWith("onClick=", k)) return true;
  }
  return false;
}

function isAcceptable(attrs: string): boolean {
  const flat = attrs.replace(/\s+/g, "");
  // Объявлен интерактивным явно — диктор и клавиатура работают.
  if (/role=|tabIndex|onKeyDown|onKeyUp/.test(flat)) return true;
  // Подложка-затемнение: клик по фону закрывает окно. Приём допустимый —
  // закрыть окно можно и настоящей кнопкой внутри него.
  if (flat.includes("inset:0") && (flat.includes("fixed") || flat.includes("absolute"))) return true;
  return false;
}

export function findInaccessibleControls(src: string): number[] {
  const lines: number[] = [];
  for (let i = src.indexOf("<"); i >= 0; i = src.indexOf("<", i)) {
    const tag = tagAt(src, i);
    if (!tag) {
      i += 1;
      continue;
    }
    if (hasOwnOnClick(tag.attrs) && !isAcceptable(tag.attrs)) {
      lines.push(src.slice(0, i).split("\n").length);
    }
    i = tag.end;
  }
  return lines;
}

describe("клик на неинтерактивном элементе", () => {
  it("на охраняемых страницах управления доступны с клавиатуры", () => {
    const bad: string[] = [];
    for (const zone of GUARDED) {
      for (const file of filesUnder(join(APP_DIR, zone))) {
        for (const line of findInaccessibleControls(readFileSync(file, "utf8"))) {
          bad.push(`${relative(APP_DIR, file).split(String.fromCharCode(92)).join("/")}:${line}`);
        }
      }
    }
    expect(
      bad,
      "onClick на <span>/<div> без role, tabIndex и клавиатуры — " +
        "элемент недостижим с клавиатуры и не объявляется диктором как кнопка. " +
        "Нужен <button>, либо явные role + tabIndex + onKeyDown:\n" + bad.join("\n"),
    ).toEqual([]);
  });

  /**
   * Проверка САМОГО сторожа. Без неё он бы прошёл и будучи сломанным: пустой
   * список выдаётся и когда нарушений нет, и когда разбор ничего не находит.
   * Отрицательного контроля мало — нужен положительный.
   */
  it("сторож краснеет на настоящем нарушении и молчит на исправленном", () => {
    const broken = `<span onClick={() => go()} title="жми">текст</span>`;
    const asButton = `<button type="button" onClick={() => go()}>текст</button>`;
    const withRole = `<span role="button" tabIndex={0} onClick={() => go()} onKeyDown={k}>т</span>`;
    const backdrop = `<div onClick={close} style={{ position: "fixed", inset: 0 }} />`;
    const nestedButton = `<div style={{ display: "flex" }}><button onClick={go}>т</button></div>`;

    expect(findInaccessibleControls(broken)).toHaveLength(1);
    expect(findInaccessibleControls(asButton)).toHaveLength(0);
    expect(findInaccessibleControls(withRole)).toHaveLength(0);
    expect(findInaccessibleControls(backdrop)).toHaveLength(0);
    // Ровно та ошибка, на которой врал первый прибор: обработчик вложенной
    // кнопки приписывался родительскому <div>.
    expect(findInaccessibleControls(nestedButton)).toHaveLength(0);
  });
});
