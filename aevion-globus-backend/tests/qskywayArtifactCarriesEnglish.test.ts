import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";
import { PERMISSION } from "../src/routes/qskyway.permission";

/**
 * Английская половина, которая ЕСТЬ в данных, обязана доехать до артефакта.
 *
 * ЧТО БЫЛО. Обоснование маршрута собирает блок разрешения ПОИМЁННО, и
 * `regimeEn` в перечисление не попал — при том что в данных городов он есть.
 * Покупатель, читающий по-английски, получал документ, где ровно одна строка
 * (режим воздушного пространства) была по-русски. Внутри того же документа
 * `scope` спарен со `scopeEn` — то есть это недосмотр, а не решение:
 * непоследовательность в одном месте почти всегда недосмотр.
 *
 * ПОЧЕМУ ЭТО ВАЖНЕЕ, ЧЕМ ПОХОЖИЕ МЕЛОЧИ НА СТРАНИЦЕ. Артефакт путешествует
 * ОДИН. Страницу можно перевести переключателем; документ, который человек
 * унёс, ничем уже не исправишь — он читается без нас.
 *
 * ПРАВИЛО ВЫВОДИТСЯ ИЗ ДАННЫХ, а не задано списком: любое поле, у которого в
 * данных есть половина на En, обязано быть в документе. Появится новое —
 * сторож потребует его сам.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

const hasLatin = (s: string) => [...s].some((c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));

describe("артефакт уносит английскую половину, если она есть в данных", () => {
  test("каждое поле XEn из данных доехало до документа", async () => {
    const a = app();
    let citiesChecked = 0;
    let fieldsChecked = 0;
    const bad: string[] = [];

    for (const [cityId, data] of Object.entries(PERMISSION)) {
      const enKeys = Object.keys(data).filter((k) => k.endsWith("En"));
      if (enKeys.length === 0) continue;

      const res = await request(a)
        .post("/api/qskyway/route/justification")
        .send({ city: cityId, from: 0, to: 1 });
      if (res.status !== 200) continue;

      const block = res.body?.document?.permission;
      expect(block, "у города " + cityId + " есть разрешение в данных, а в документе блока нет").toBeTruthy();
      citiesChecked += 1;

      for (const k of enKeys) {
        fieldsChecked += 1;
        const v = block?.[k];
        if (typeof v !== "string" || v.trim() === "") {
          bad.push(cityId + ": поле " + k + " не доехало до документа");
          continue;
        }
        if (!hasLatin(v)) bad.push(cityId + ": поле " + k + " доехало, но латиницы в нём нет: " + v.slice(0, 40));
      }
    }

    // Контроль охвата: ноль проверенных означал бы, что сторож ослеп.
    expect(citiesChecked, "ни один город не проверен — сторож ослеп").toBeGreaterThan(0);
    expect(fieldsChecked, "ни одного поля XEn не найдено в данных").toBeGreaterThan(0);
    expect(bad, "английская половина потерялась по дороге:" + bad.join(" | ")).toEqual([]);
  });
});
