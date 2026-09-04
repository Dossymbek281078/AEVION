import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Заметка о ветре обязана нести обе половины.
 *
 * ЗАЧЕМ. Строка ветра показывает ДВА числа: у земли и на высоте. Значок
 * источника говорит METAR, но METAR наблюдается у поверхности и данных о ветре
 * на высоте не содержит вовсе - число на высоте это модель. Оговорка про это
 * написана в `wind.note`, и до 04.09.2026 она была ТОЛЬКО по-русски: то есть
 * существовала для читающего наш API по-русски и ни для кого больше.
 *
 * Класс тот же, что мы ловили весь день: неудобная половина написана, но не
 * доходит до того, кто читает. Здесь она хотя бы есть в ответе - сторож следит,
 * чтобы обе половины не разошлись и не исчезли.
 *
 * ГРАНИЦА, названная честно: казахской половины НЕТ, и сторож её НЕ требует.
 * Выдумать формулировку на языке, которого не знаешь, хуже, чем оставить
 * названный пробел. Появится носитель - добавим и потребуем.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

const hasLatin = (s: string) => [...s].some((c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));
const hasCyr = (s: string) => [...s].some((c) => c >= "Ѐ" && c <= "ӿ");

describe("заметка о ветре несёт обе половины", () => {
  test("у каждого города есть note и noteEn, и они на разных языках", async () => {
    const a = app();
    const cities = ["astana", "nyc", "tokyo"];
    let checked = 0;
    const bad: string[] = [];

    for (const city of cities) {
      const res = await request(a).get("/api/qskyway/city").query({ city });
      if (res.status !== 200) continue;
      checked += 1;
      const w = res.body?.wind ?? {};

      if (typeof w.note !== "string" || w.note.trim() === "") bad.push(city + ": нет note");
      if (typeof w.noteEn !== "string" || w.noteEn.trim() === "") bad.push(city + ": нет noteEn");
      if (typeof w.note === "string" && !hasCyr(w.note)) bad.push(city + ": note не по-русски");
      if (typeof w.noteEn === "string" && hasCyr(w.noteEn)) bad.push(city + ": noteEn содержит кириллицу");
      if (typeof w.noteEn === "string" && !hasLatin(w.noteEn)) bad.push(city + ": noteEn без латиницы");
    }

    // Контроль охвата: ноль городов означал бы, что сторож ослеп.
    expect(checked, "ни один город не ответил - сторож ослеп").toBeGreaterThanOrEqual(2);
    expect(bad, "заметка о ветре потеряла половину: " + bad.join(", ")).toEqual([]);
  });

  test("в ветке METAR обе половины называют высоту", async () => {
    // Смысл оговорки в том, что число НА ВЫСОТЕ - модель. Но в тестах сети нет,
    // METAR не забирается, и код честно уходит в иллюстративную ветку, где
    // модельный уже и наземный ветер - там про высоту говорить нечего.
    //
    // Поэтому проверка НЕ безусловная. Чтобы она не стала тихо пустой, ветка
    // называется вслух: если однажды в тестах появится METAR, утверждение
    // включится само, а пока видно, какая ветка проверена.
    const res = await request(app()).get("/api/qskyway/city").query({ city: "astana" });
    expect(res.status).toBe(200);
    const w = res.body?.wind ?? {};
    expect(["metar", "illustrative"], "источник ветра неизвестного вида").toContain(String(w.source));

    if (w.source === "metar") {
      expect(String(w.note), "русская заметка молчит про высоту").toContain("высот");
      expect(String(w.noteEn).toLowerCase(), "английская заметка молчит про высоту").toContain("altitude");
    } else {
      // Обе половины обязаны назвать METAR как причину, иначе человек не поймёт,
      // почему модель: "иллюстративная модель" без причины звучит как выбор.
      expect(String(w.note)).toContain("METAR");
      expect(String(w.noteEn)).toContain("METAR");
    }
  });
});
