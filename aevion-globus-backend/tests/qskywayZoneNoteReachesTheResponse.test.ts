import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";
import { NOFLY } from "../src/routes/qskyway.zones";

/**
 * Оговорка зоны обязана доезжать до ответа ОБЕИМИ половинами.
 *
 * ИСТОРИЯ, ради которой сторож. Соседнее окно сообщило, что `realityNote`
 * отсекается проекцией и до ответа не доходит. Я это повторил в отчёте
 * основателю - и оба раза мы ошиблись одинаково: строка проекции длинная, мы
 * читали её ОБРЕЗАННОЙ и не видели хвоста. Поле отдавалось всегда.
 *
 * Настоящим было другое: заметка написана только по-русски, английской
 * половины не было. Её и добавили.
 *
 * Сторож закрывает обе стороны сразу: и что поле не потеряется при следующей
 * правке проекции, и что половины не разойдутся. Правило выводится ИЗ ДАННЫХ -
 * какие зоны несут заметку, у тех она и требуется в ответе.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

const hasLatin = (s: string) => [...s].some((c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));
const hasCyr = (s: string) => [...s].some((c) => c >= "Ѐ" && c <= "ӿ");

describe("оговорка зоны доезжает до ответа обеими половинами", () => {
  test("где в данных есть заметка, там она есть и в ответе", async () => {
    const a = app();
    let checkedCities = 0;
    let checkedZones = 0;
    const bad: string[] = [];

    for (const [cityId, zones] of Object.entries(NOFLY)) {
      const withNote = zones.filter((z) => typeof z.realityNote === "string" && z.realityNote.trim() !== "");
      if (withNote.length === 0) continue;

      const res = await request(a).get("/api/qskyway/city").query({ city: cityId });
      if (res.status !== 200) continue;
      checkedCities += 1;

      const out = Array.isArray(res.body?.nofly) ? res.body.nofly : [];
      for (const z of withNote) {
        checkedZones += 1;
        const row = out.find((x: { id?: string }) => x?.id === z.id);
        if (!row) {
          bad.push(cityId + "/" + z.id + ": зоны нет в ответе");
          continue;
        }
        if (typeof row.realityNote !== "string" || row.realityNote.trim() === "") {
          bad.push(cityId + "/" + z.id + ": заметка не доехала");
        }
        if (typeof row.realityNoteEn !== "string" || row.realityNoteEn.trim() === "") {
          bad.push(cityId + "/" + z.id + ": нет английской половины");
        } else {
          if (hasCyr(row.realityNoteEn)) bad.push(cityId + "/" + z.id + ": английская половина содержит кириллицу");
          if (!hasLatin(row.realityNoteEn)) bad.push(cityId + "/" + z.id + ": английская половина без латиницы");
        }
      }
    }

    // Контроль охвата: ноль зон означал бы, что сторож ослеп, а не что чисто.
    expect(checkedCities, "ни один город с заметкой не проверен").toBeGreaterThanOrEqual(1);
    expect(checkedZones, "ни одной зоны с заметкой не проверено").toBeGreaterThanOrEqual(1);
    expect(bad, "оговорка потерялась по дороге: " + bad.join(", ")).toEqual([]);
  });

  test("обе половины называют настоящую зону, а не только нашу фигуру", async () => {
    // Смысл оговорки в сравнении: наш круг маленький, настоящий запрет шире.
    // Если из текста исчезнет упоминание настоящей зоны, останется признание
    // "фигура наша" без того, что за ней стоит.
    const res = await request(app()).get("/api/qskyway/city").query({ city: "astana" });
    expect(res.status).toBe(200);
    const z = (res.body?.nofly ?? []).find((x: { realityNote?: string }) => x?.realityNote);
    expect(z, "зоны с заметкой не нашлось").toBeTruthy();
    expect(String(z.realityNote)).toContain("UAP28");
    expect(String(z.realityNoteEn)).toContain("UAP28");
  });
});
