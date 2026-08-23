/**
 * /go — единственная кликабельная ссылка в шапках соцсетей, и её работа —
 * собрать адрес. Замер 21.08.2026 на телефоне 390×844: поле адреса лежало на
 * y=2067, то есть в 2.4 экранах прокрутки, а раздел про здоровье шёл ПЕРЕД
 * ближайшим запуском. Человек, пришедший по ролику о шахматах, не видел ни
 * шахмат, ни поля для адреса.
 *
 * Порядок секций и есть воронка, поэтому он проверяется, а не хранится в
 * голове у того, кто правил страницу последним.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.join(__dirname, "..", "page.tsx");
const src = fs.readFileSync(PAGE, "utf8");

const at = (needle: string) => src.indexOf(needle);

describe("/go — порядок воронки", () => {
  it("страница читается и содержит все опорные секции", () => {
    for (const s of ["Ближайший запуск", "WaitlistCapture", "Здоровье и долголетие", "Вся платформа"]) {
      expect(at(s), `нет секции: ${s}`).toBeGreaterThan(-1);
    }
  });

  it("ближайший запуск идёт раньше остальных разделов", () => {
    expect(at("Ближайший запуск")).toBeLessThan(at("Здоровье и долголетие"));
    expect(at("Ближайший запуск")).toBeLessThan(at("Вся платформа"));
  });

  it("форма сбора адресов стоит до длинных разделов, а не в конце", () => {
    const form = src.indexOf("<WaitlistCapture");
    expect(form, "формы на странице нет").toBeGreaterThan(-1);
    expect(form).toBeLessThan(at("Здоровье и долголетие"));
    expect(form).toBeLessThan(at("Книга"));
  });
});
