import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Отказы несут английскую половину В ФАКТИЧЕСКОМ ОТВЕТЕ, а не только в коде.
 *
 * Зачем отдельно от `qskywayRefusalsSpeakEnglish`. Тот сторож читает ИСХОДНИК:
 * он видит, что строка написана рядом с парой, и это его честная граница. Но
 * «строка есть в файле» и «поле пришло клиенту» — разные утверждения: значение
 * может не попасть в ответ (не та ветка), уехать под другим именем или быть
 * затёртым обработчиком ошибок выше по стеку.
 *
 * А соседний `qskywayEnglishFieldsClean` обходит живые ответы, но сам называет
 * свою границу: покрыты только ДОСТИЖИМЫЕ ветки, и ветки отказа туда не
 * попадают — он ходит по УСПЕШНЫМ вызовам. Здесь закрыт ровно этот стык.
 *
 * Проверяем не текст перевода, а его НАЛИЧИЕ и отсутствие кириллицы в поле,
 * обещающем английский.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

/** Отказы, до которых можно дойти БЕЗ базы и без внешних вызовов. */
const CASES: Array<{ name: string; run: () => request.Test }> = [
  {
    name: "неизвестный город (GET /city)",
    run: () => request(app()).get("/api/qskyway/city").query({ city: "щщщ-нет-такого" }),
  },
  {
    name: "неизвестный город (GET /vertiports)",
    run: () => request(app()).get("/api/qskyway/vertiports").query({ city: "щщщ-нет-такого" }),
  },
  {
    name: "нечисловые from/to (POST /route)",
    run: () => request(app()).post("/api/qskyway/route").send({ from: "a", to: "b" }),
  },
  {
    name: "нечисловые from/to (POST /route/justification)",
    run: () => request(app()).post("/api/qskyway/route/justification").send({ from: "a", to: "b" }),
  },
  {
    name: "пустое тело у проверки обоснования",
    run: () => request(app()).post("/api/qskyway/route/justification/verify").send({}),
  },
];

describe("отказы QSkyway несут английскую половину в самом ответе", () => {
  for (const c of CASES) {
    test(c.name, async () => {
      const res = await c.run();
      // Контроль прибора: это должен быть именно ОТКАЗ. Если ручка вдруг
      // ответила успехом, проверка ниже прошла бы вхолостую и мы бы этого
      // не заметили — «нет непарных отказов» при нуле отказов.
      expect(res.status, "ожидался отказ 4xx, а ручка ответила успехом").toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      const body = res.body ?? {};
      expect(typeof body.error, "в ответе нет поля error").toBe("string");
      expect(body.errorEn, "английская половина не доехала до клиента").toBeTruthy();
      expect(hasCyrillic(String(body.errorEn)), "в errorEn кириллица: положили русский текст").toBe(false);
      // И русская половина обязана остаться русской: пара, где обе половины
      // английские, читается как перевод, а по сути теряет исходный текст.
      expect(hasCyrillic(String(body.error)), "русская половина исчезла").toBe(true);
    });
  }

  test("свод отказов в общий ответ не потерял поле available", () => {
    // 28.08.2026 одиннадцать копий отказа «неизвестный город» свели в один
    // refuseUnknownCity. Вместе с текстом там ехало `available` — список
    // городов, по которому клиент понимает, что предложить человеку. Пропажа
    // такого поля не роняет ничего и не видна ни в одном тесте про текст.
    return request(app())
      .get("/api/qskyway/city")
      .query({ city: "щщщ-нет-такого" })
      .then((res) => {
        expect(Array.isArray(res.body?.available), "поле available исчезло").toBe(true);
        expect(res.body.available.length, "список городов пуст").toBeGreaterThan(0);
      });
  });
});
