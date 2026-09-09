import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { devhubServerError } from "@/lib/devhubServerError";

/**
 * Замер 09.09.2026, накануне запуска. Правило про исчерпанный предел
 * переводило ФРАЗУ, но само имя нормы подставляло машинным словом:
 *
 *   «Месячная норма исчерпана: video. Она обновится первого числа…»
 *   «Месячная норма исчерпана: deploy…», «…: TTS character…»
 *
 * Намерение автора было верным — имя сохраняли, «иначе непонятно, ЧТО
 * исчерпалось». Недоделано следствие: имя осталось английским внутри русской
 * фразы. Это тот же жаргон на экране, что был у подсказок возможностей.
 *
 * Цена не теоретическая: завтра гости упираются в бесплатные пределы
 * (видео 3, картинки 10, публикации 10), и фразу увидят многие.
 *
 * EN-ветка намеренно оставлена как есть: «Monthly video limit reached» —
 * нормальный английский, и правило зоны говорит, что тексты сервера для
 * EN-читателя родные.
 */
const BACKEND = path.resolve(
  __dirname, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);
const F = "Не удалось выполнить действие";

describe("имя исчерпанной нормы человек читает по-русски", () => {
  test("прибор работает: правило про предел вообще срабатывает", () => {
    const out = devhubServerError("Monthly video limit reached", F, "ru");
    expect(out, "правило про пределы не сработало").toMatch(/Месячная норма исчерпана/);
  });

  test("машинное имя не доезжает до экрана", () => {
    for (const [text, ozhid] of [
      ["Monthly video limit reached", "видео"],
      ["Monthly deploy limit reached", "публикации"],
      ["Monthly image limit reached", "картинки"],
      ["Monthly TTS character limit reached", "знаки озвучки"],
    ] as const) {
      const out = devhubServerError(text, F, "ru");
      expect(out, `${text}: имя нормы осталось машинным`).toContain(ozhid);
      expect(out, `${text}: английское слово доехало до экрана`).not.toMatch(/video|deploy|image|TTS/);
    }
  });

  test("имя всё ещё НАЗЫВАЕТСЯ — без него непонятно, что исчерпалось", () => {
    const out = devhubServerError("Monthly music limit reached", F, "ru");
    expect(out, "имя нормы пропало вовсе — это шаг назад").toMatch(/музыка/);
  });

  test("незнакомое имя карта не портит, а возвращает как есть", () => {
    const out = devhubServerError("Monthly widgets limit reached", F, "ru");
    expect(out, "карта съела незнакомое имя").toContain("widgets");
  });

  test("другие правила с подстановкой не сломаны", () => {
    const out = devhubServerError("email is required", F, "ru");
    expect(out, "правило про обязательное поле перестало подставлять").toContain("email");
  });

  test("EN-читателю оставлен родной английский, а не русская калька", () => {
    expect(devhubServerError("Monthly video limit reached", F, "en")).toBe("Monthly video limit reached");
  });

  test("карта покрывает нормы, которые сервер РЕАЛЬНО отдаёт", () => {
    const src = fs.readFileSync(BACKEND, "utf8");
    const imena = new Set<string>();
    for (const m of src.matchAll(/"Monthly ([\w ]+?) limit reached"/g)) imena.add(m[1].toLowerCase());
    expect(imena.size, "имён норм не нашлось — дальше любой ноль был бы зелёным").toBeGreaterThan(3);
    const bez: string[] = [];
    for (const im of imena) {
      const out = devhubServerError(`Monthly ${im} limit reached`, F, "ru");
      if (out.includes(im)) bez.push(im);
    }
    expect(bez, "эти нормы человек прочитает машинным словом").toEqual([]);
  });
});
