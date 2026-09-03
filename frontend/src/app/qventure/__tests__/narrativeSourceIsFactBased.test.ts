import { describe, it, expect } from "vitest";
import { istochnikTeksta } from "../_result";

/**
 * Источник текста записки называется ПО ФАКТУ ответа модели.
 *
 * До 03.09.2026 признак считался от НАСТРОЙКИ поставщика:
 * `aiUsed: provider !== "stub"`. Если поставщик настроен, а вызовы падают
 * (кончилась квота, битый ключ, провайдер лежит), все четыре линзы и записка
 * подставлялись заготовкой — а экран печатал платящему «Текст собран: живая
 * модель». Утверждение о продукте, которое не выполняется.
 *
 * ПОЧЕМУ ЭТОТ ТЕСТ ОТДЕЛЬНО ОТ narrativeEngineIsShown. Тот сторож читает
 * РАЗМЕТКУ и проверяет, что надпись есть и зависит от признака. Мутация
 * показала его границу: подмена условия на `if (true)` оставляет слово aiLive
 * в файле, и текстовый сторож проходит. Поведение проверяется только вызовом.
 */

const P = { aiProvider: "openai" };

describe("источник текста записки — по факту, а не по настройке", () => {
  it("все части от модели — «живая модель»", () => {
    const t = istochnikTeksta({ ...P, aiUsed: true, aiLive: 5, aiTotal: 5 });
    expect(t).toContain("живая модель");
    expect(t).toContain("openai");
  });

  it("модель не ответила ни разу — так и сказано, без слова «живая»", () => {
    const t = istochnikTeksta({ ...P, aiUsed: false, aiLive: 0, aiTotal: 5 });
    expect(t).toContain("не ответила");
    // Ключевое: в этом состоянии слова «живая модель» быть НЕ должно.
    expect(t).not.toContain("живая модель");
  });

  it("часть частей — названо частичным, а не округлено в лучшую сторону", () => {
    const t = istochnikTeksta({ ...P, aiUsed: true, aiLive: 2, aiTotal: 5 });
    expect(t).toContain("частично");
    expect(t).toContain("2");
    expect(t).toContain("5");
    // Округление вверх — это и есть прежняя ложь, только мягче.
    expect(t).not.toContain("живая модель");
  });

  it("старая запись без полей — честное «не знаю», а не прежнее утверждение", () => {
    const t = istochnikTeksta({ ...P, aiUsed: true });
    expect(t).toContain("не записан");
    expect(t).not.toContain("живая модель");
  });

  it("КОНТРОЛЬ: четыре состояния дают четыре РАЗНЫХ текста", () => {
    const vse = [
      istochnikTeksta({ ...P, aiUsed: true, aiLive: 5, aiTotal: 5 }),
      istochnikTeksta({ ...P, aiUsed: false, aiLive: 0, aiTotal: 5 }),
      istochnikTeksta({ ...P, aiUsed: true, aiLive: 2, aiTotal: 5 }),
      istochnikTeksta({ ...P, aiUsed: true }),
    ];
    // Без этого контроля функция, возвращающая одну строку на всё, прошла бы
    // три проверки выше, если бы строка содержала все нужные слова разом.
    expect(new Set(vse).size, "состояния не различаются текстом").toBe(4);
  });
});
