import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Имена наших переменных окружения не должны уходить посетителю.
 *
 * ЧТО БЫЛО. Пояснение к ключу подписи говорило человеку:
 * «The signing key is stable (QSKYWAY_SIGN_SK)», а в одноразовом режиме —
 * «Provide QSKYWAY_SIGN_SK for a stable key», то есть посетитель читал
 * инструкцию оператору и узнавал, как называется переменная с ключом подписи.
 * Значение не утекало, но имя — это подсказка о нашем устройстве, и в тексте
 * для человека ей делать нечего.
 *
 * ПОЧЕМУ СЕРВЕР В ПРОЦЕССЕ, А НЕ ГРЕП ПО ИСХОДНИКУ. Греп отвечает «что я
 * проверил», а не «что увидит человек»: строка может собираться из кусков,
 * приходить из другого модуля или не попадать в ответ вовсе. Здесь читается
 * настоящее тело ответа.
 *
 * ГРАНИЦА, названная честно: проверяются только те ручки, что перечислены
 * ниже. Появится новая ручка с пояснением — сторож о ней не узнает.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

/** Форма имени переменной окружения: ДВА_СЛОВА_ЗАГЛАВНЫМИ через подчёркивание. */
const ENVISH = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/;

/** Собрать ВСЕ строковые значения ответа: пояснение может лежать на любой глубине. */
function strings(v: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 6 || v == null) return out;
  if (typeof v === "string") {
    out.push(v);
    return out;
  }
  if (Array.isArray(v)) {
    for (const x of v) strings(x, out, depth + 1);
    return out;
  }
  if (typeof v === "object") {
    for (const x of Object.values(v as Record<string, unknown>)) strings(x, out, depth + 1);
  }
  return out;
}

async function bodies() {
  const out: Array<{ where: string; body: unknown }> = [];
  const verify = await request(app()).get("/api/qskyway/verify").query({ city: "astana" });
  expect(verify.status, "/verify должна отвечать").toBe(200);
  out.push({ where: "/verify", body: verify.body });

  const city = await request(app()).get("/api/qskyway/city").query({ city: "astana" });
  expect(city.status, "/city должна отвечать").toBe(200);
  out.push({ where: "/city", body: city.body });

  const just = await request(app())
    .post("/api/qskyway/route/justification")
    .send({ city: "astana", from: 0, to: 1 });
  expect(just.status, "/route/justification должна отвечать").toBe(200);
  out.push({ where: "/route/justification", body: just.body });

  return out;
}

describe("тексты для посетителя не называют наши переменные окружения", () => {
  test("прибор умеет находить: подсаженное имя переменной ловится", () => {
    // Без этого контроля ноль неотличим от «не умею искать».
    expect(ENVISH.test("The signing key is stable (QSKYWAY_SIGN_SK)")).toBe(true);
    expect(ENVISH.test("Ed25519 подпись, город Астана, MLIT")).toBe(false);
  });

  test("ни в одном ответе нет имени переменной окружения", async () => {
    const seen = await bodies();
    let scanned = 0;
    const bad: string[] = [];

    for (const { where, body } of seen) {
      for (const s of strings(body)) {
        scanned += 1;
        const m = s.match(ENVISH);
        if (m) bad.push(where + "  «" + m[0] + "»  в: " + s.slice(0, 80));
      }
    }

    // Контроль охвата: ноль строк означал бы, что сторож ослеп, а не что чисто.
    expect(scanned, "строк не собрано вовсе — сторож ослеп").toBeGreaterThan(20);
    expect(bad, "имя переменной окружения в тексте для посетителя:\n" + bad.join("\n")).toEqual([]);
  });
});
