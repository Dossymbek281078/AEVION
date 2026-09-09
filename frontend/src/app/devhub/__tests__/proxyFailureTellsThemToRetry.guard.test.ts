import { describe, test, expect } from "vitest";
import { devhubServerError } from "@/lib/devhubServerError";

/**
 * Замер 09.09.2026, за сутки до запуска. Проба «соберёт ли человек приложение»
 * (aevion-devhub-can-build.mjs) упала: генерация ответила 502 с телом
 *
 *   {"status":"error","code":502,"message":"Application failed to respond",
 *    "request_id":"xZrkIDEVSVWXqP-J-_9nXA"}
 *
 * Это ответ ПОСРЕДНИКА, а не нашего кода: бэкенд в ту же минуту отвечал 200 на
 * /health за 0.5 с. Повтор прошёл за 18 секунд и принёс три файла — то есть
 * отказ преходящий и повтор ПОМОГАЕТ.
 *
 * Что видел человек до правки (прогнано через саму функцию, не прочитано):
 *   русский      «Не удалось сгенерировать проект» — без совета повторить;
 *   английский   «Application failed to respond» — голая фраза чужого прокси.
 *
 * Второе хуже: EN-посетитель в день запуска читает служебный текст Railway и
 * не понимает, что делать. Ветка EN не применяет карту НАМЕРЕННО (тексты
 * сервера — контракт на английском), но это не наш текст и не контракт.
 */
const FALLBACK = "Не удалось сгенерировать проект";
const OTVET_PROKSI = "Application failed to respond";

describe("отказ посредника говорит человеку повторить", () => {
  test("прибор работает: обычный текст сервера идёт прежним путём", () => {
    const out = devhubServerError("Monthly deploy limit reached", FALLBACK, "ru");
    expect(out, "правило про пределы перестало работать").not.toBe(FALLBACK);
    expect(out).toMatch(/[а-яё]/i);
  });

  test("русскому: человеческая фраза и совет повторить", () => {
    const out = devhubServerError(OTVET_PROKSI, FALLBACK, "ru");
    expect(out, "фраза прокси доехала до экрана").not.toContain("Application");
    expect(out, "совет повторить — он ПРАВДА помогает, замер 18 с").toMatch(/ещё раз/i);
  });

  test("английскому: НЕ голая фраза прокси", () => {
    const out = devhubServerError(OTVET_PROKSI, FALLBACK, "en");
    expect(out, "EN-посетитель читает служебный текст чужой инфраструктуры").not.toBe(OTVET_PROKSI);
    expect(out, "и ему тоже нужен совет повторить").toMatch(/try again/i);
  });

  test("казахскому отвечаем как русскому, а не по-английски", () => {
    const out = devhubServerError(OTVET_PROKSI, FALLBACK, "kk");
    expect(out).not.toContain("Application");
  });

  test("совет НЕ обещает, что настройка сломана — это была бы неправда", () => {
    for (const lang of ["ru", "en", "kk"]) {
      const out = devhubServerError(OTVET_PROKSI, FALLBACK, lang);
      expect(out, `${lang}: сказали «не настроено», хотя всё настроено`).not.toMatch(/не настроен|not set up/i);
    }
  });

  test("Bad Gateway от любого прокси — тот же класс", () => {
    expect(devhubServerError("502 Bad Gateway", FALLBACK, "ru")).toMatch(/ещё раз/i);
  });

  test("похожие, но ДРУГИЕ тексты этим правилом не перехватываются", () => {
    // Отрицательный контроль: правило не должно глотать нормальные отказы.
    const kvota = devhubServerError("Monthly video limit reached", FALLBACK, "ru");
    expect(kvota, "квота подменилась советом повторить — повтор тут НЕ поможет").not.toMatch(/попробуйте ещё раз через минуту/i);
  });
});
