import { describe, it, expect } from "vitest";
import { escapeLikePattern, LIKE_ESCAPE_SQL } from "../src/lib/startupx/likePattern";

/**
 * Эти проверки существуют потому, что дефект дожил до настоящего Postgres:
 * поиск с процентом молча отдавал пустую ленту, а in-memory ветка (обычный
 * `includes`) этого не показывала. Здесь пришпилен ровно тот вывод, который
 * должен уехать в SQL.
 */
describe("экранирование поиска для ILIKE", () => {
  it("процент и подчёркивание становятся обычными символами", () => {
    expect(escapeLikePattern("5%")).toBe("5\\%");
    expect(escapeLikePattern("_рейса")).toBe("\\_рейса");
    expect(escapeLikePattern("100%_рост")).toBe("100\\%\\_рост");
  });

  it("обратный слэш экранирует сам себя — иначе он съедает следующий символ", () => {
    expect(escapeLikePattern("\\")).toBe("\\\\");
    expect(escapeLikePattern("\\%")).toBe("\\\\\\%");
  });

  it("обычный текст не трогается", () => {
    expect(escapeLikePattern("перевозчики")).toBe("перевозчики");
    expect(escapeLikePattern("")).toBe("");
  });

  it("в выводе нет литерала ${m} — это и был баг", () => {
    // Прежняя версия писала `\${m}` внутри шаблонной строки и подставляла в
    // запрос литеральные символы «$», «{», «m», «}».
    for (const q of ["5%", "_", "%%", "a_b"]) {
      expect(escapeLikePattern(q)).not.toContain("${m}");
      expect(escapeLikePattern(q)).not.toContain("$");
    }
  });

  it("escape-символ в SQL — один обратный слэш, а не пустая строка", () => {
    // `ESCAPE ''` — валидный SQL, означающий «экранирования нет»; именно в него
    // превращалась строка `ESCAPE '\'`, написанная в шаблонной строке.
    expect(LIKE_ESCAPE_SQL).toBe("ESCAPE '" + String.fromCharCode(92) + "'");
    expect(LIKE_ESCAPE_SQL).not.toBe("ESCAPE ''");
  });

  it("пара «экранирование + ESCAPE» описывает один и тот же символ", () => {
    const escChar = LIKE_ESCAPE_SQL.slice("ESCAPE '".length, -1);
    expect(escapeLikePattern("%").startsWith(escChar)).toBe(true);
  });
});
