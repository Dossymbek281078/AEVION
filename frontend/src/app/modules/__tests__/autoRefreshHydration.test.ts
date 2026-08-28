import { describe, it, expect } from "vitest";
import { lastUpdatedLabel } from "../AutoRefreshToggle";

/**
 * Главное свойство: до монтирования подпись НЕ зависит от часов.
 *
 * Ровно это и было сломано. Замер на проде 28.08.2026: `/modules` бросала
 * `Minified React error #418` — «текст не совпал с серверным». Подпись
 * «Получено: N назад» считалась через `Date.now()` прямо в отрисовке, а он на
 * сервере и при гидратации разный, поэтому React выбрасывал разметку и
 * перерисовывал поддерево. Глазами это не видно: страница выглядит нормально.
 *
 * Проверка сформулирована как инвариант, а не как «строка равна такой-то»:
 * утверждение про конкретный текст пережило бы возврат `Date.now()` в отрисовку,
 * если бы текст случайно совпал.
 */
describe("подпись «когда получены данные» и гидратация", () => {
  const AT = "2026-08-28T09:15:00.000Z";

  it("до монтирования результат ОДИНАКОВ при любых часах", () => {
    const a = lastUpdatedLabel({ generatedAt: AT, now: 0, lang: "ru", mounted: false });
    const b = lastUpdatedLabel({ generatedAt: AT, now: 1e12, lang: "ru", mounted: false });
    const c = lastUpdatedLabel({ generatedAt: AT, now: Date.now(), lang: "ru", mounted: false });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("до монтирования подпись выведена из самого пропа", () => {
    expect(lastUpdatedLabel({ generatedAt: AT, now: 0, lang: "ru", mounted: false })).toBe("09:15 UTC");
  });

  it("до монтирования язык не меняет подпись — иначе сервер и клиент разойдутся по языку", () => {
    const ru = lastUpdatedLabel({ generatedAt: AT, now: 0, lang: "ru", mounted: false });
    const en = lastUpdatedLabel({ generatedAt: AT, now: 0, lang: "en", mounted: false });
    expect(ru).toBe(en);
  });

  it("ПОСЛЕ монтирования подпись зависит от часов — ради этого всё и затевалось", () => {
    const at = Date.parse(AT);
    const свежая = lastUpdatedLabel({ generatedAt: AT, now: at + 5_000, lang: "ru", mounted: true });
    const старая = lastUpdatedLabel({ generatedAt: AT, now: at + 600_000, lang: "ru", mounted: true });
    expect(свежая).toBe("только что");
    expect(старая).not.toBe(свежая);
    expect(String(старая)).toContain("назад");
  });

  it("английский после монтирования — свой текст", () => {
    const at = Date.parse(AT);
    expect(lastUpdatedLabel({ generatedAt: AT, now: at + 5_000, lang: "en", mounted: true })).toBe("just now");
    expect(String(lastUpdatedLabel({ generatedAt: AT, now: at + 600_000, lang: "en", mounted: true }))).toContain("ago");
  });

  it("нет данных или мусор вместо даты — null, а не падение и не «только что»", () => {
    expect(lastUpdatedLabel({ generatedAt: undefined, now: 0, lang: "ru", mounted: true })).toBeNull();
    expect(lastUpdatedLabel({ generatedAt: "не дата", now: 0, lang: "ru", mounted: true })).toBeNull();
    expect(lastUpdatedLabel({ generatedAt: "не дата", now: 0, lang: "ru", mounted: false })).toBeNull();
  });
});
