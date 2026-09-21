// Лента активности Planet не показывает наши прогоны.
//
// Замер на проде 20.09.2026, день запуска: GET /api/planet/activity?limit=50 —
// 24 записи из 50 наши: title "smoke-music-1784717120863", ref "smoke-music-test".
// Настоящие записи выглядят иначе: title отсутствует, ref — обычный идентификатор
// вида 6e63e8fd-6912-49d4-be3a-ddef30bee77f.
//
// Фильтр главной страницы (`isProbeArtifact`) сюда не годился: у ленты другие поля,
// и защищена была только главная — /planet и /planet/activity показывали пробы.
import { describe, test, expect } from "vitest";
import { isProbeActivity } from "../planetData";

describe("лента Planet: проба отличается от работы автора", () => {
  test("пробы с прода опознаются (настоящие значения, не выдуманные)", () => {
    expect(isProbeActivity({ title: "smoke-music-1784717120863", ref: "smoke-music-test" })).toBe(true);
    expect(isProbeActivity({ title: "smoke-music-1782190269428", ref: "smoke-music-test" })).toBe(true);
    expect(isProbeActivity({ title: null, ref: "smoke-cap-route" })).toBe(true);
    expect(isProbeActivity({ title: "test-key", ref: null })).toBe(true);
    expect(isProbeActivity({ title: null, ref: "k1784717120863" })).toBe(true);
  });

  test("КОНТРОЛЬ: настоящая запись НЕ считается пробой", () => {
    // Живые записи с того же ответа прода.
    expect(isProbeActivity({ title: null, ref: "6e63e8fd-6912-49d4-be3a-ddef30bee77f" })).toBe(false);
    expect(isProbeActivity({ title: null, ref: "cbd69b62-c661-4396-bac1-3e2de93bb715" })).toBe(false);
    // И осмысленные заголовки авторов — тоже не пробы.
    expect(isProbeActivity({ title: "Утро в степи", ref: "d0534a2a-ca3b-4f45-87b1-e3ba08b78057" })).toBe(false);
    expect(isProbeActivity({ title: "Smetana Quartet", ref: "b1b2c3d4-0000-4000-8000-000000000000" })).toBe(false);
    expect(isProbeActivity({})).toBe(false);
  });
});
