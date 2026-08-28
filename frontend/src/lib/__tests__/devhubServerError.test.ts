import { describe, test, expect } from "vitest";
import { devhubServerError } from "../devhubServerError";

const FB = "Не удалось выполнить действие";

describe("текст серверной ошибки — на языке человека", () => {
  test("частая группа «X required» становится понятной", () => {
    // Замер 28.08: так отвечают 30+ ручек модуля.
    expect(devhubServerError("prompt required", FB)).toContain("обязательное поле");
    expect(devhubServerError("prompt required", FB)).toContain("prompt");
    expect(devhubServerError("name required", FB)).toContain("name");
  });

  test("длинный текст с уточнением в скобках тоже разбирается", () => {
    const s = devhubServerError("imageUrl (http/https) is required - generate or upload first", FB);
    expect(s).toContain("обязательное поле");
    expect(s).not.toMatch(/required/i);
  });

  test("незнакомое НЕ прячется — иначе человек и мы остаёмся без зацепки", () => {
    const s = devhubServerError("weird upstream hiccup 42", FB);
    expect(s).toContain(FB);
    expect(s, "исходный текст потерян — жалобу будет не по чему найти").toContain("weird upstream hiccup 42");
  });

  test("русский текст сервера не трогаем", () => {
    const ru = "Хранилище недоступно: изменение сохранено только до перезапуска.";
    expect(devhubServerError(ru, FB)).toBe(ru);
  });

  test("нет текста — показывается русский запасной", () => {
    expect(devhubServerError(undefined, FB)).toBe(FB);
    expect(devhubServerError("", FB)).toBe(FB);
    expect(devhubServerError("   ", FB)).toBe(FB);
    expect(devhubServerError(42, FB)).toBe(FB);
  });

  test("настройка канала не выдаётся за поломку", () => {
    const s = devhubServerError("Google Drive not configured — set GOOGLE_DRIVE_KEY", FB);
    expect(s).toContain("не подключён");
    expect(s, "имя переменной окружения на экране у покупателя").not.toContain("GOOGLE_DRIVE_KEY");
  });

  test("предел темпа и деньги названы по-разному", () => {
    expect(devhubServerError("rate limit exceeded", FB)).toContain("Слишком часто");
    expect(devhubServerError("insufficient credits", FB)).toContain("средств");
  });

  test("ни один ответ не пуст и не начинается с латиницы", () => {
    // Контроль формы: перевод, который вернул пустоту, хуже отсутствия перевода.
    for (const raw of ["prompt required", "not found", "unauthorized", "weird", "", "тест"]) {
      const s = devhubServerError(raw, FB);
      expect(s.length).toBeGreaterThan(3);
    }
  });
});
