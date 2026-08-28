import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Серверный текст ошибки не показывается человеку без перевода.
 *
 * Замер 28.08.2026: у ручек модуля 119 разных текстов ошибок, по-русски семь.
 * В рабочем окне они выводились как `data.error || "русский запасной"`, то есть
 * русская строка была ЗАПАСНОЙ и появлялась лишь при молчании сервера.
 *
 * Сторож держит форму: показ идёт через devhubServerError. Он переводит частые
 * группы, а незнакомое отдаёт как есть — вместе с понятным поводом.
 */

const DIR = path.resolve(__dirname, "..");
const WORKSPACE = fs.readFileSync(path.join(DIR, "[id]", "page.tsx"), "utf8");

describe("серверная ошибка доходит до человека по-русски", () => {
  test("прибор исправен: файл прочитан и не пуст", () => {
    expect(WORKSPACE.length).toBeGreaterThan(2000);
  });

  test("прежней формы «data.error || текст» не осталось", () => {
    // Позиционный поиск, не регулярка: собранная из строки регулярка на этой
    // машине теряет слэши, и детектор молча отвечает «ноль» (см. правила).
    const bad: string[] = [];
    WORKSPACE.split(/\r?\n/).forEach((line, i) => {
      if (line.includes('data.error || "')) bad.push(`строка ${i + 1}`);
    });
    expect(bad, "серверный английский текст снова показывается напрямую").toEqual([]);
  });

  test("показ идёт через переводчик, и мест не меньше девяти", () => {
    // Храповик, а не точное число: девять — замер дня, а мест станет больше.
    const uses = WORKSPACE.split("devhubServerError(data.error").length - 1;
    expect(uses).toBeGreaterThanOrEqual(9);
  });

  test("переводчик импортирован, а не забыт", () => {
    // Без импорта TypeScript упал бы, но проверка стоит копейки и называет
    // причину прямо — быстрее, чем разбирать ошибку сборки.
    expect(WORKSPACE).toContain('from "@/lib/devhubServerError"');
  });
});
