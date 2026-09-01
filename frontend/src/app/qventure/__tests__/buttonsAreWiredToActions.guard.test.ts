import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Кнопки модуля связаны с действиями, а не только нарисованы.
 *
 * Замер 31.08.2026, мутацией: сделал обработчик главной кнопки разбора пустым
 * (onClick={() => {}}) — все 17 проверок модуля остались ЗЕЛЁНЫМИ. То есть
 * кнопка, ради которой существует модуль за $39/мес, не была закреплена ничем.
 *
 * Третий случай одного класса за вечер: до этого так же оказались не
 * закреплены ссылка оплаты в стене платного доступа (25 проверок зелёные) и
 * ссылки покупки товаров (480 зелёных).
 *
 * Закономерность: сторожа пишут на то, что происходит ПОСЛЕ нажатия — там
 * ветвления, состояния, крайние случаи, это интересно проверять. А что само
 * нажатие связано с действием, не проверяет никто: «там нечего проверять».
 * Ровно поэтому связь и исчезает молча при правке вёрстки.
 *
 * Проверка читает ИСХОДНИК: поднимать страницу с формой и настоящим запросом
 * дороже, чем польза, а вопрос здесь простой — есть ли связь.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const SRC = fs.readFileSync(path.resolve(HERE, "..", "page.tsx"), "utf8");
// Экраны модуля, где есть кнопки: одиночный разбор, пакетный и сам разбор.
// Список получен ПЕРЕЧИСЛЕНИЕМ, а не по памяти: за день я дважды сказал
// «поверхностей две», а их оказывалось три и пять.
const BATCH = fs.readFileSync(path.resolve(HERE, "..", "batch", "page.tsx"), "utf8");
const RESULT = fs.readFileSync(path.resolve(HERE, "..", "_result.tsx"), "utf8");
const NL = String.fromCharCode(10);
const BODY = SRC.split(NL).filter((l) => !l.trim().startsWith("//")).join(NL);

/** Обработчики, стоящие на кнопках: текст между onClick={ и первой } . */
function handlersIn(src: string): string[] {
  const out: string[] = [];
  const body = src.split(NL).filter((l) => !l.trim().startsWith("//")).join(NL);
  const parts = body.split("onClick={");
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf("}");
    if (end > 0) out.push(parts[i].slice(0, end).trim());
  }
  return out;
}

function handlers(): string[] {
  const out: string[] = [];
  const parts = BODY.split("onClick={");
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf("}");
    if (end > 0) out.push(parts[i].slice(0, end).trim());
  }
  return out;
}

describe("кнопки модуля делают то, что обещают", () => {
  it("контроль: страница прочитана и кнопки найдены", () => {
    expect(SRC.length, "страница не прочитана").toBeGreaterThan(5000);
    expect(handlers().length, "кнопок с обработчиком не найдено").toBeGreaterThan(3);
  });

  it("ни один обработчик не пустой", () => {
    // () => {} и () => null рисуют кнопку, которая ничего не делает. Человек
     
    // жмёт, ничего не происходит, и никакой ошибки при этом нет.
    const empty = handlers().filter((h) => {
      const t = h.replace(/\s/g, "");
      return t === "()=>{" || t === "()=>{}" || t === "()=>null" || t === "";
    });
    expect(empty, "у кнопки пустой обработчик: нажатие ни к чему не приводит").toEqual([]);
  });

  it("главная кнопка зовёт разбор", () => {
    // Именно она — смысл модуля. Замена её обработчика на пустой не ловилась
     
    // ничем до 31.08.2026.
    expect(
      BODY,
      "главная кнопка больше не зовёт run(form): нажатие не запускает разбор",
    ).toContain("onClick={() => run(form)}");
  });

  it("на всех экранах модуля нет пустых обработчиков", () => {
    // Замер 31.08.2026: кнопка загрузки файла в пакетном разборе и кнопка
    // «поделиться» переживали выпотрошивание незамеченными.
    const bad: string[] = [];
    for (const [name, src] of [["batch", BATCH], ["result", RESULT]] as const) {
      for (const h of handlersIn(src)) {
        const t = h.replace(/\s/g, "");
        if (t === "()=>{" || t === "()=>{}" || t === "()=>null" || t === "") bad.push(name + ": " + h);
      }
    }
    expect(bad, "у кнопки пустой обработчик: нажатие ни к чему не приводит").toEqual([]);
  });

  it("вход в пакетный разбор связан: кнопка открывает выбор файла", () => {
    // Это ВХОД в модуль — как данные вообще попадают внутрь. Сломается —
    // пакетный разбор станет бесполезным, и ни одна ошибка не появится.
    expect(
      BATCH,
      "кнопка загрузки не открывает выбор файла: данные в пакетный разбор не попадут",
    ).toContain("fileRef.current?.click()");
  });

  it("кнопка примера и кнопка сравнения тоже связаны", () => {
    expect(BODY, "кнопка примера потеряла обработчик").toContain("onClick={runSample}");
    expect(BODY, "кнопка сравнения потеряла обработчик").toContain("onClick={run}");
  });
});
