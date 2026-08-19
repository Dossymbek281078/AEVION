import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "../src/lib/constitutionSchemas";

/**
 * Поле называется message_ru — значит в нём должен быть русский текст.
 *
 * 19.08.2026, живой прод:
 *
 *   POST /api/constitution/waitlist/subscribe  {}
 *   → {"field":"email","message_ru":"Invalid input: expected string, received undefined"}
 *
 * Перевод был написан под формулировки Zod v3, а в зависимостях стоит v4.
 * Разошлись они молча: тип возврата остался строкой, ничего не упало, тесты
 * были зелёными — просто наружу поехал developer-facing английский. Вторая
 * ловушка сверху: проверка искала слово «Expected» с большой буквы, а в v4 оно
 * строчное.
 *
 * Место дорогое: это форма подписки на /go, единственной ссылке из шапок
 * соцсетей. Английская ошибка в русской форме отпугивает ровно того человека,
 * ради которого снимается ролик.
 *
 * Тест проверяет не формулировки, а свойство: что бы ни прислали, в message_ru
 * есть кириллица и нет сырого текста библиотеки.
 */

const Schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(10),
  age: z.number().min(18).max(120),
  role: z.enum(["reader", "author"]),
});

function app() {
  const a = express();
  a.use(express.json());
  a.post("/probe", validate(Schema), (_req, res) => res.json({ ok: true }));
  return a;
}

/** Наборы, каждый из которых бьёт по своему коду ошибки Zod. */
const CASES: Array<{ name: string; body: unknown }> = [
  { name: "пустое тело — поля отсутствуют", body: {} },
  { name: "неверный тип", body: { email: 1, name: 2, age: "сорок", role: 3 } },
  { name: "неверный email", body: { email: "не-адрес", name: "Аня", age: 30, role: "reader" } },
  { name: "слишком короткая строка", body: { email: "a@b.co", name: "Я", age: 30, role: "reader" } },
  { name: "слишком длинная строка", body: { email: "a@b.co", name: "ОченьДлинноеИмя", age: 30, role: "reader" } },
  { name: "число вне диапазона", body: { email: "a@b.co", name: "Аня", age: 5, role: "reader" } },
  { name: "значение не из списка", body: { email: "a@b.co", name: "Аня", age: 30, role: "кто-то" } },
];

const CYRILLIC = /[а-яё]/i;

describe("ошибки проверки формы приходят по-русски", () => {
  test("контроль: схема действительно отвергает мусор", async () => {
    // Если бы схема всё принимала, все проверки ниже проходили бы вхолостую.
    const res = await request(app()).post("/probe").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.fields.length).toBeGreaterThan(0);
  });

  test("контроль: верное тело проходит", async () => {
    const res = await request(app())
      .post("/probe")
      .send({ email: "a@b.co", name: "Аня", age: 30, role: "reader" });
    expect(res.status).toBe(200);
  });

  for (const c of CASES) {
    test(`${c.name} — сообщение на русском`, async () => {
      const res = await request(app()).post("/probe").send(c.body as object);
      expect(res.status).toBe(400);

      const bad: string[] = [];
      for (const f of res.body.fields as Array<{ field: string; message_ru: string }>) {
        if (!CYRILLIC.test(f.message_ru)) bad.push(`${f.field}: «${f.message_ru}»`);
        // Отдельно ловим узнаваемый текст библиотеки — он выдаёт себя даже
        // если однажды окажется рядом с кириллицей.
        if (/invalid input|expected .* received|zod/i.test(f.message_ru)) {
          bad.push(`${f.field}: сырой текст Zod — «${f.message_ru}»`);
        }
      }

      expect(bad, `в message_ru не русский текст:\n  ${bad.join("\n  ")}`).toEqual([]);
    });
  }
});
