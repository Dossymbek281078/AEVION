import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: подача заявки в программу и запрос ссылки для входа НЕ делят бюджет.
 *
 * ЧТО БЫЛО (замер 02.09.2026). Ограничитель программ ключуется как
 * `${kind}:${ip}`, и обе ручки — /affiliate/apply и /affiliate/magic-link —
 * передавали kind "affiliate". Бюджет: 3 запроса на 10 минут, причём
 * считаются ВСЕ попытки, включая отбитые проверкой формы.
 *
 * Следствие для человека: партнёр дважды опечатался в заявке — и на десять
 * минут не может запросить ссылку для входа. Найдено потоковой пробой: после
 * четырёх обращений к /affiliate/apply ручка magic-link отбивала ПЕРВЫЙ же
 * запрос.
 *
 * Проверяется поведение, а не имена ключей: исчерпали одну ручку — соседняя
 * обязана отвечать.
 */
const { pricingRouter } = await import("../src/routes/pricing");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

const ПАРЫ = [
  ["affiliate", "/api/pricing/affiliate/apply", "/api/pricing/affiliate/magic-link"],
  ["partners", "/api/pricing/partners/apply", "/api/pricing/partners/magic-link"],
] as const;

describe.each(ПАРЫ.map(([имя, заявка, вход]) => [имя, заявка, вход] as const))(
  "бюджеты программы не общие: %s",
  (имя, заявка, вход) => {
    test("исчерпав заявку, вход остаётся доступен", async () => {
      const app = приложение();

      // КОНТРОЛЬ: у входа бюджет есть до того, как мы трогали заявку.
      const до = await request(app).post(вход).send({ email: `a@${имя}.test` });
      expect(до.status, `[${имя}] вход отбит ДО всякой нагрузки — проверять нечего`).not.toBe(429);

      // Исчерпываем заявку заведомо неверными телами: считаются все попытки.
      let заявкаОтбита = false;
      for (let i = 0; i < 10; i += 1) {
        const r = await request(app).post(заявка).send({});
        if (r.status === 429) { заявкаОтбита = true; break; }
      }
      expect(заявкаОтбита, `[${имя}] заявка не имеет предела — сравнивать не с чем`).toBe(true);

      const после = await request(app).post(вход).send({ email: `b@${имя}.test` });
      expect(
        после.status,
        `[${имя}] исчерпали заявку — и закрылся ВХОД: бюджет общий, партнёр не сможет войти 10 минут`
      ).not.toBe(429);
    });
  }
);
