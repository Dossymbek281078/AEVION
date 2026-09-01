import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { AIRSPACE } from "../src/routes/qskyway.airspace";
import { PERMISSION } from "../src/routes/qskyway.permission";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Охват регуляторными данными не завышается.
 *
 * ПОВОД (29.08.2026, мутационный аудит). Подмена `withCeilings` на общее число
 * городов проходила незамеченной, хотя меняет поведение: городов три, а сетка
 * потолков есть только у Нью-Йорка. Отчёт сказал бы «3 из 3».
 *
 * Это заявление о зрелости продукта: сколько городов мы реально покрыли
 * данными регулятора. Завысить его — то же, что нарисовать на витрине карту с
 * тремя флажками вместо одного.
 *
 * Сторож сверяет число с ДАННЫМИ, а не со своей копией: считает сам по
 * AIRSPACE и PERMISSION.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("охват регуляторными данными назван честно", () => {
  test("withCeilings равен числу городов, у которых сетка ЕСТЬ", async () => {
    // ⚠️ Поля живут в /cities, а не в /health. Первая версия угадывала форму
    // и падала — форму ответа надо спрашивать, а не предполагать. Третий раз
    // за ночь одна и та же ошибка.
    const res = await request(app()).get("/api/qskyway/cities");
    expect(res.status).toBe(200);
    const cov = res.body?.airspaceCoverage;
    const withCeilings = cov?.withCeilings;
    expect(typeof withCeilings, "поле withCeilings пропало").toBe("number");
    expect(withCeilings, "охват завышен относительно данных").toBe(Object.keys(AIRSPACE).length);
  });

  test("withFeed и withRegulatoryLayer тоже сверены с данными", async () => {
    // Соседние поля того же блока. Мутация withFeed прошла мимо первой версии
    // сторожа: я проверил одно число и решил, что закрыл блок. Поля рядом —
    // это отдельные утверждения, а не украшение вокруг главного.
    const res = await request(app()).get("/api/qskyway/cities");
    const cov = res.body?.airspaceCoverage;
    expect(cov?.withFeed, "охват фидом завышен").toBe(Object.keys(AIRSPACE).length);
    const both = new Set([...Object.keys(AIRSPACE), ...Object.keys(PERMISSION)]);
    expect(cov?.withRegulatoryLayer, "охват регуляторным слоем завышен").toBe(both.size);
    expect(cov?.total, "общее число городов разошлось").toBe((res.body?.cities ?? []).length);
  });

  test("withPermissionRegime так же", async () => {
    const res = await request(app()).get("/api/qskyway/cities");
    const cov = res.body?.airspaceCoverage;
    expect(cov?.withPermissionRegime).toBe(Object.keys(PERMISSION).length);
  });

  test("список городов без данных согласован с числами", async () => {
    // ⚠️ Сегодня `missing` ПУСТ: у всех трёх городов есть либо сетка потолков,
    // либо разрешительный режим. Значит подмена «missing: []» поведения не
    // меняет, и отдельной проверкой на непустоту его закрыть нельзя — она была
    // бы вечно зелёной по случайности данных.
    //
    // Закрепляем то, что проверяемо: список согласован с числами. Появится
    // город без данных — проверка сработает сама, без правки.
    const res = await request(app()).get("/api/qskyway/cities");
    const cov = res.body?.airspaceCoverage;
    expect(Array.isArray(cov?.missing)).toBe(true);
    expect(
      cov.missing.length,
      "список отсутствующих не сходится с охватом",
    ).toBe(cov.total - cov.withRegulatoryLayer);
  });

  test("🔴 охват НЕ полный — иначе проверка не различает", async () => {
    // Отрицательный контроль: пока есть город без сетки, «все города покрыты»
    // отличимо от правды. Покроем все — условие снимется само, и тогда стоит
    // пересмотреть проверку, а не радоваться зелёному.
    const res = await request(app()).get("/api/qskyway/cities");
    const total = (res.body?.cities ?? []).length;
    expect(total, "список городов пуст").toBeGreaterThan(0);
    expect(
      Object.keys(AIRSPACE).length,
      "сетка есть у всех городов — проверка охвата стала слепой",
    ).toBeLessThan(total);
  });
});
