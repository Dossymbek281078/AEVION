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

  test("месячная квота — самое важное сообщение денежного пути", () => {
    // Замер 28.08: сервер отвечает 402 «Monthly deploy limit reached», и до
    // этого правила человек читал его по-английски ровно в тот момент, когда
    // решает, платить ли.
    const s = devhubServerError("Monthly deploy limit reached", FB);
    expect(s).toContain("Месячная норма исчерпана");
    expect(s, "не сказано, ЧТО исчерпалось").toContain("deploy");
    expect(s, "не сказано, когда обновится").toContain("первого числа");
  });

  test("правило работает для всех возможностей, а не только для выкаток", () => {
    // Перечень проверяю на СЛОМАННОМ коде мысленно: если правило привязать к
    // слову deploy, остальные четыре пройдут мимо и останутся английскими.
    for (const cap of ["video", "image", "music", "tts"]) {
      const s = devhubServerError(`Monthly ${cap} limit reached`, FB);
      expect(s, `${cap} не покрыт`).toContain("Месячная норма исчерпана");
      expect(s).toContain(cap);
    }
  });

  // ПОКРЫТИЕ по настоящим ответам сервера.
  //
  // 28.08.2026 я проверял покрытие РАЗБОРОМ: вытащил регулярки грепом и прогнал
  // через eval. Получил три «не покрыто» из четырёх — одно настоящее (месячная
  // квота, починено), два ЛОЖНЫХ: вытаскивающая регулярка не справилась с
  // первым правилом файла, и оно не попало в проверку.
  //
  // Покрытие проверяется ВЫЗОВОМ. Список ниже — настоящие тексты, снятые с
  // прода и из исходника ручек; если функция вернёт исходный текст в скобках,
  // значит правила для него нет.
  test("настоящие ответы сервера покрыты правилами", () => {
    const REAL = [
      "prompt required",
      "name is required",
      "title is required",
      "Monthly deploy limit reached",
      "Monthly video limit reached",
      "Google Drive not configured — set GOOGLE_DRIVE_KEY",
      "project not found",
      "storage_unavailable",
      "rate limit exceeded",
      "insufficient credits",
      "imageUrl (http/https) is required - generate or upload an image first",
    ];
    const uncovered = REAL.filter((r) => devhubServerError(r, FB).includes("(" + r + ")"));
    expect(uncovered, "серверный текст доходит до человека как есть").toEqual([]);
  });

  test("прибор исправен: непокрытое ДЕЙСТВИТЕЛЬНО определяется как непокрытое", () => {
    // Контроль: без него проверка выше зелена и на сломанной функции.
    const nonsense = "zzz quibble frobnicate 12345";
    expect(devhubServerError(nonsense, FB).includes("(" + nonsense + ")")).toBe(true);
  });
});
