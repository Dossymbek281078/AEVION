import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Класс .cc-focus-ring снимает контур (`outline: none`) и рисует кольцо
 * ТЕНЬЮ. Если у элемента своя тень задана СТРОЧНЫМ стилем, она сильнее —
 * кольца нет, а контур уже снят. Класс выглядит как забота о доступности
 * и ею не является ровно там, где у кнопки есть своя тень.
 *
 * Замер 03.09.2026 обходом с клавиатуры (Tab, не programmatic focus —
 * тот не даёт :focus-visible и врёт нулём на ВСЕХ кнопках):
 *
 *   без класса:  кольцо видно у 23 из 23
 *   с классом:   кольцо видно у 14 из 16 — не видно у «Пуля» и «Рапид»,
 *                то есть ровно у тех, где boxShadow задан строчно.
 *
 * Правило: если у кнопки СВОЯ тень в style, класс ей не нужен — общее
 * правило контура (globals.css) работает и поверх строчных стилей.
 */

import { readdirSync, statSync } from "node:fs";

const КОРЕНЬ = join(__dirname, "..");

/** Все исходники модуля, а не один файл: класс живёт и в общих компонентах. */
function исходники(каталог: string, найдено: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    if (имя === "__tests__" || имя === "node_modules") continue;
    const п = join(каталог, имя);
    if (statSync(п).isDirectory()) исходники(п, найдено);
    else if (/\.tsx?$/.test(имя)) найдено.push(п);
  }
  return найдено;
}

const КОД = () => bezKommentariev(readFileSync(join(КОРЕНЬ, "page.tsx"), "utf8"));

describe("кольцо фокуса", () => {
  it("кнопки со своей тенью не глушат фокус классом", () => {
    const код = КОД();
    // ищем места, где в ОДНОМ элементе и класс, и строчная тень
    // Окно в 400 символов было ГАДАНИЕМ: у кнопки контроля времени объект
    // стилей длиннее, и проверка молча не находила ничего — мутация «вернуть
    // класс» проходила. Разбираем ПО ТЕГАМ, без окна.
    const плохие: string[] = [];
    for (const кусок of код.split("<button").slice(1)) {
      // Конец тега — первый «>» на НУЛЕВОЙ глубине фигурных скобок. Простой
      // indexOf(">") ловил «>» внутри обработчика (`if(first>=0)`) и обрезал
      // тег ДО стилей: проверка молча ничего не находила, и мутация «вернуть
      // класс» проходила дважды подряд. Поймано мутацией, а не чтением.
      let глубина = 0, конец = -1;
      for (let i = 0; i < кусок.length; i++) {
        const c = кусок[i];
        if (c === "{") глубина++;
        else if (c === "}") глубина--;
        else if (c === ">" && глубина === 0) { конец = i; break; }
      }
      const тег = конец > 0 ? кусок.slice(0, конец) : кусок;
      if (тег.includes("cc-focus-ring") && /boxShadow\s*:/.test(тег)) {
        плохие.push(тег.replace(/\s+/g, " ").slice(0, 70));
      }
    }
    expect(плохие).toEqual([]);
  });

  it("по ВСЕМУ модулю, а не только в page.tsx", () => {
    // 04.09.2026: page.tsx был чист, а два места жили в общих компонентах
    // (ui.tsx: кнопка Btn и вкладка) — то есть в КАЖДОЙ кнопке модуля сразу.
    const файлы = исходники(КОРЕНЬ);
    expect(файлы.length).toBeGreaterThan(100); // контроль охвата
    const плохие: string[] = [];
    for (const ф of файлы) {
      const код = bezKommentariev(readFileSync(ф, "utf8"));
      for (const имя of ["button", "div"]) {
        for (const кусок of код.split("<" + имя).slice(1)) {
          let глубина = 0, конец = -1;
          for (let i = 0; i < кусок.length; i++) {
            const c = кусок[i];
            if (c === "{") глубина++;
            else if (c === "}") глубина--;
            else if (c === ">" && глубина === 0) { конец = i; break; }
          }
          const тег = конец > 0 ? кусок.slice(0, конец) : кусок;
          if (тег.includes("cc-focus-ring") && тег.includes("boxShadow")) {
            плохие.push(ф.slice(КОРЕНЬ.length + 1));
          }
        }
      }
    }
    expect([...new Set(плохие)]).toEqual([]);
  });

  it("контроль прибора: разбор тегов НАХОДИТ сломанный случай", () => {
    // Без этого «ноль нарушителей» ничего не значит. Проверяю САМ АЛГОРИТМ на
    // строках, ответ для которых известен заранее.
    const разбор = (код: string) => {
      let n = 0;
      for (const кусок of код.split("<button").slice(1)) {
        let глубина = 0, конец = -1;
        for (let i = 0; i < кусок.length; i++) {
          const c = кусок[i];
          if (c === "{") глубина++;
          else if (c === "}") глубина--;
          else if (c === ">" && глубина === 0) { конец = i; break; }
        }
        const тег = конец > 0 ? кусок.slice(0, конец) : кусок;
        if (тег.includes("cc-focus-ring") && тег.includes("boxShadow")) n++;
      }
      return n;
    };
    expect(разбор('<button className="cc-focus-ring" style={{boxShadow:"a"}}>x</button>')).toBe(1);
    expect(разбор('<button className="cc-focus-ring">x</button><button style={{boxShadow:"a"}}>y</button>')).toBe(0);
    expect(разбор('<button onClick={()=>{if(a>0)f()}} className="cc-focus-ring" style={{boxShadow:"a"}}>x</button>')).toBe(1);
  });

  it("контроль охвата: класс в модуле вообще используется", () => {
    // иначе первая проверка охраняла бы пустоту
    const n = (КОД().match(/cc-focus-ring/g) || []).length;
    expect(n).toBeGreaterThan(10);
  });
});
