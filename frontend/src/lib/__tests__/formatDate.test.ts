/**
 * Проверяем ГЛАВНОЕ свойство: дата следует за языком СТРАНИЦЫ, а не за
 * языком браузера и не за жёстко вписанной локалью.
 *
 * Именно это и было сломано в личном кабинете 28.08: три разных способа на
 * одной странице, и самый аккуратный на вид — `toLocaleDateString("ru-RU")` —
 * показывал русскую дату англоязычному покупателю.
 */

import { describe, expect, it, afterEach } from "vitest";
import { formatDate, formatDateTime, pageLocale } from "../formatDate";

const ISO = "2026-08-28T12:00:00.000Z";

function setLang(v: string | null) {
  if (v === null) document.documentElement.removeAttribute("lang");
  else document.documentElement.setAttribute("lang", v);
}

afterEach(() => setLang(null));

describe("дата следует за языком страницы", () => {
  it("контроль прибора: язык читается из <html lang>", () => {
    setLang("kk");
    expect(pageLocale()).toBe("kk");
    setLang(null);
    expect(pageLocale("en"), "без атрибута — умолчание, а не пусто").toBe("en");
    setLang("   ");
    expect(pageLocale("en"), "пробелы — тоже не язык").toBe("en");
  });

  it("одна и та же дата выглядит РАЗНО на разных языках", () => {
    setLang("ru");
    const ru = formatDate(ISO);
    setLang("en");
    const en = formatDate(ISO);
    // Суть починки: результат ЗАВИСИТ от языка страницы.
    expect(ru, `ru=«${ru}» en=«${en}» — форматы не различаются`).not.toBe(en);
    expect(ru.length, "пустая строка вместо даты").toBeGreaterThan(4);
    expect(en.length, "пустая строка вместо даты").toBeGreaterThan(4);
  });

  it("непригодное значение не превращается в пустоту и не падает", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    // мусор возвращаем как есть: по нему видно, что пришло с сервера
    expect(formatDate("не-дата")).toBe("не-дата");
    expect(formatDateTime("не-дата")).toBe("не-дата");
  });

  it("формат с временем содержит время, без времени — нет", () => {
    setLang("en");
    const withTime = formatDateTime(ISO);
    const dateOnly = formatDate(ISO);
    expect(/\d{1,2}:\d{2}/.test(withTime), `в «${withTime}» нет времени`).toBe(true);
    expect(/\d{1,2}:\d{2}/.test(dateOnly), `в «${dateOnly}» время лишнее`).toBe(false);
  });
});
