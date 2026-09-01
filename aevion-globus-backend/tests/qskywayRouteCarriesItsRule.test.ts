import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { PERMISSION } from "../src/routes/qskyway.permission";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Ответ маршрута НЕСЁТ правило, которому маршрут подчиняется.
 *
 * ПОВОД (29.08.2026). У городов без сетки потолков ответ говорил «соответствие
 * потолку не проверялось, см. permission в /health». Честно — но требовало
 * второго запроса, а действуют по ответу МАРШРУТА.
 *
 * Без правила рядом «сетки потолков нет» читается как «ничто не регулирует».
 * У Астаны там ЗАПРЕТ: коридор обходит запретные зоны, и об этом надо узнать
 * из того же ответа, а не из другого.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("маршрут несёт действующее правило, а не отсылку", () => {
  const withRegime = Object.keys(PERMISSION);

  test("города с режимом есть — иначе проверка пуста", () => {
    expect(withRegime.length).toBeGreaterThan(0);
  });

  for (const city of Object.keys(PERMISSION)) {
    test(city + ": правило приехало вместе с маршрутом", async () => {
      const r = await request(app()).post("/api/qskyway/route").send({ from: 0, to: 2, city });
      expect(r.status).toBe(200);
      const a = r.body?.airspace;
      expect(a?.available, city + ": ожидался город без сетки потолков").toBe(false);
      expect(
        a?.permission,
        city + ": правило названо в тексте, но не приехало в ответе",
      ).toBeTruthy();
      expect(
        a.permission.kind,
        city + ": вид режима разошёлся с данными регулятора",
      ).toBe(PERMISSION[city].kind);
    });
  }

  test("у города С сеткой правило не подставляется вместо потолка", async () => {
    // Зеркальная половина: где потолок есть, соответствие ему и проверяется.
    // Подсунуть сюда permission значило бы подменить предмет разговора.
    const r = await request(app()).post("/api/qskyway/route").send({ from: 0, to: 2, city: "nyc" });
    expect(r.body?.airspace?.available).toBe(true);
    expect(r.body?.airspace?.permission ?? null).toBeNull();
  });

  // ⚠️ ЧЕГО ЭТОТ СТОРОЖ НЕ ПРОВЕРЯЕТ, и почему.
  //
  // Условие `hasPermission ? perm : null` отличается от простого `perm` только
  // для города, у которого НЕТ ни сетки потолков, ни разрешительного режима.
  // Такого города сегодня нет: у всех трёх есть одно из двух. Значит мутация
  // «подставлять правило всегда» поведения не меняет, и проверить её нечем —
  // тест был бы вечно зелёным по случайности данных, а выглядел бы охраной.
  //
  // Появится город без регулятора — условие станет проверяемым, и тогда сюда
  // надо дописать случай. Пока честнее назвать границу, чем изобразить охрану.

  test("примечание и поле говорят одно и то же", async () => {
    // Текст обещает, что правило действует; поле обязано это подтверждать.
    const city = withRegime[0];
    const r = await request(app()).post("/api/qskyway/route").send({ from: 0, to: 2, city });
    const a = r.body?.airspace;
    const mentions = String(a?.noteEn ?? "").toLowerCase().includes("regulator rule does apply");
    expect(mentions && Boolean(a?.permission), "текст обещает правило, а поля нет").toBe(true);
  });
});
