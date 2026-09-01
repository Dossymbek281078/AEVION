import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { PERMISSION, permissionSummary } from "../src/routes/qskyway.permission";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Запрет не называется разрешительным режимом.
 *
 * ПОВОД (29.08.2026, мутационный аудит прежних сторожей). Подмена `kind` на
 * "permission" проходила НЕЗАМЕЧЕННОЙ, хотя меняет поведение: у Астаны режим
 * `prohibition`, и страница выбирает подпись именно по этому полю.
 *
 * То есть человеку сказали бы, что над городом нужно лишь РАЗРЕШЕНИЕ, тогда
 * как там ЗАПРЕТ. Это самая дорогая ошибка из возможных в модуле: остальные
 * врут о качестве данных, эта — о законности полёта.
 *
 * Проверяем не «поле есть», а что оно СОВПАДАЕТ с данными регулятора: тест,
 * закрепляющий свою копию значения, поймал бы не переименование, а ничего.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("режим города называется так, как в данных", () => {
  const cities = Object.keys(PERMISSION);

  test("города с режимом вообще есть — иначе проверка пуста", () => {
    expect(cities.length, "в PERMISSION нет ни одного города").toBeGreaterThan(0);
  });

  for (const id of Object.keys(PERMISSION)) {
    test(id + ": kind в ответе равен kind в данных", () => {
      const s = permissionSummary(id) as { available: boolean; kind?: string };
      expect(s.available).toBe(true);
      expect(
        s.kind,
        id + ": режим в ответе разошёлся с данными регулятора",
      ).toBe(PERMISSION[id].kind);
    });
  }

  test("хотя бы один город В ДАННЫХ имеет запрет — иначе подмена незаметна", () => {
    // Отрицательный контроль. Если запретов не станет, проверки выше
    // перестанут отличать "permission" от чего бы то ни было: мутация
    // «всегда разрешение» пройдёт, а набор останется зелёным.
    const kinds = cities.map((c) => PERMISSION[c].kind);
    expect(kinds, "ни у одного города нет запрета").toContain("prohibition");
  });

  test("через HTTP город с запретом тоже назван запретом", async () => {
    const prohibited = cities.find((c) => PERMISSION[c].kind === "prohibition");
    expect(prohibited, "нет города с запретом").toBeTruthy();
    const res = await request(app()).get("/api/qskyway/city?city=" + prohibited);
    expect(res.status).toBe(200);
    expect(
      res.body?.airspace?.permission?.kind,
      "по HTTP запрет доехал как что-то другое",
    ).toBe("prohibition");
  });
});
