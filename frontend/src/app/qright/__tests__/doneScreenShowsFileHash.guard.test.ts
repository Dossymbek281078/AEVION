/*
 * 30.10.2026 (окно Приложения-2·Бюро), проход прода 043aa4cc7 с файлом: виджет
 * считает SHA-256 файла, бэк его хранит, /verify и кабинет показывают — а карточка
 * результата сразу после «Защитить работу» отпечаток не показывала, хотя витрина
 * обещает «сохраним рядом с сертификатом как доказательство, что именно этот файл
 * существовал». Сторож: карточка печатает File Hash, когда он есть, и словарь
 * знает подпись на ru и kk.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QRIGHT_DICT, tq } from "../qrightI18n";

const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("карточка результата /qright показывает отпечаток файла", () => {
  it("поле File Hash стоит в списке полей карточки и берётся из ответа бэка или из браузера", () => {
    const i = PAGE.indexOf('label: tq(lang, "File Hash (SHA-256)")');
    expect(i, "в карточке нет поля File Hash (SHA-256)").toBeGreaterThan(0);
    const окно = PAGE.slice(i - 400, i + 200);
    expect(окно).toContain("result.certificate.fileHash ?? fileHash");
    // Только при наличии: пустое поле читалось бы как «отпечаток потерян».
    expect(окно).toMatch(/\?\s*\[\{ label: tq\(lang, "File Hash \(SHA-256\)"\)/);
  });

  it("тип ответа знает fileHash (старый бэк поля не шлёт — оно необязательное)", () => {
    expect(PAGE).toMatch(/fileHash\?: string \| null;/);
  });

  it("словарь: подпись переведена на ru и kk", () => {
    expect(QRIGHT_DICT.ru?.["File Hash (SHA-256)"]).toBe("Хеш файла (SHA-256)");
    expect(QRIGHT_DICT.kk?.["File Hash (SHA-256)"]).toBe("Файл хеші (SHA-256)");
    expect(tq("ru", "File Hash (SHA-256)")).toBe("Хеш файла (SHA-256)");
    expect(tq("en", "File Hash (SHA-256)")).toBe("File Hash (SHA-256)");
  });
});
