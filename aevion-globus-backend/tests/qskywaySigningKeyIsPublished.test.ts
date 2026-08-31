import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Ключ подписи опубликован отдельно от подписанных им документов.
 *
 * ПОВОД. 28.08.2026: документ обоснования несёт настоящую Ed25519-подпись и
 * открытый ключ — но ключ лежит В ТОМ ЖЕ документе. Проверка ключом из
 * проверяемого документа доказывает лишь внутреннюю связность: подписать своим
 * ключом и приложить его может кто угодно. Нигде больше ключ не публиковался:
 * ни в состоянии модуля, ни в реестре ключей платформы (`/api/qsign/v2/keys`
 * держит ключи QSign, не наши).
 *
 * Проверка требует трёх вещей, и третья — самая важная: ключ из состояния
 * службы обязан ДЕЙСТВИТЕЛЬНО проверять подпись документа. Совпадение строк
 * доказывало бы только копипасту.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("ключ подписи QSkyway доступен независимо от документа", () => {
  test("состояние модуля публикует ключ и честно называет его природу", async () => {
    const res = await request(app()).get("/api/qskyway/health");
    expect(res.status).toBe(200);
    const s = res.body?.signing;
    expect(s, "блок signing исчез из состояния").toBeTruthy();
    expect(s.alg).toBe("Ed25519");
    expect(typeof s.publicKey === "string" && s.publicKey.length > 40, "ключ пуст").toBe(true);
    expect(typeof s.ephemeral, "не сказано, постоянный ключ или нет").toBe("boolean");
    // Оговорка обязана меняться вместе с природой ключа: одинаковый текст для
    // постоянного и временного ключа хуже отсутствия текста.
    expect(String(s.note).length, "оговорка пуста").toBeGreaterThan(30);
    expect(String(s.noteEn).length, "оговорки нет по-английски").toBeGreaterThan(30);
  });

  test("опубликованным ключом подпись документа ПРОВЕРЯЕТСЯ, а не просто совпадает строкой", async () => {
    const health = await request(app()).get("/api/qskyway/health");
    const published = String(health.body?.signing?.publicKey ?? "");

    const doc = await request(app())
      .post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: "astana" });
    expect(doc.status).toBe(200);
    const att = doc.body?.attestation ?? {};
    expect(att.publicKey, "ключи службы и документа разошлись").toBe(published);

    // Главное утверждение: берём ключ ИЗ СОСТОЯНИЯ (как это сделал бы
    // регулятор) и проверяем им подпись документа настоящей криптографией.
    const key = crypto.createPublicKey({
      key: Buffer.from(published, "base64"),
      format: "der",
      type: "spki",
    });
    // ⚠️ Подпись стоит на БАЙТАХ ХЕША, а не на тексте документа. Первая версия
    // теста подписывала JSON и получила «не проверяется» — и это была ошибка
    // теста, а не ключа. Ровно так же ошибётся посторонний, если ему не сказать.
    const canonical = JSON.stringify(doc.body.document);
    const hash = crypto.createHash("sha256").update(canonical).digest("hex");
    expect(hash, "хэш документа разошёлся с заявленным").toBe(att.contentHash);
    const ok = crypto.verify(null, Buffer.from(hash, "hex"), key, Buffer.from(att.signature, "base64"));
    expect(ok, "подпись не проверяется опубликованным ключом — публикация бесполезна").toBe(true);
  });

  test("документ несёт рецепт проверки БЕЗ нас, и рецепт правдив", async () => {
    const doc = await request(app())
      .post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: "astana" });
    const v = doc.body?.verifyYourself;
    expect(v, "рецепта проверки нет — остаётся только верить нашей ручке").toBeTruthy();
    expect(Array.isArray(v.steps) && v.steps.length >= 4, "шагов слишком мало").toBe(true);
    expect(Array.isArray(v.stepsEn) && v.stepsEn.length === v.steps.length, "английская версия неполна").toBe(true);

    // ⚠️ Рецепт обязан называть НЕОЧЕВИДНОЕ: подпись стоит на байтах хэша, а не
    // на тексте. Без этого проверяющий получит «не сходится» и решит, что
    // документ поддельный — я сам так ошибся, когда писал эту проверку.
    const все = v.steps.join(" ");
    expect(/байт/i.test(все), "не сказано, что подпись на БАЙТАХ хэша").toBe(true);
    expect(/health/i.test(все), "не сказано, где взять ключ службы").toBe(true);
    // ⚠️ Рецепт не должен быть привязан к JavaScript. Проверил свои же шаги на
    // НАСТОЯЩЕМ прод-документе из python: хэш сошёлся только с компактным
    // JSON. По умолчанию `json.dumps` ставит пробелы — регулятор с python
    // получил бы «документ поддельный» на честной бумаге.
    expect(/компакт/i.test(все), "не сказано, что JSON должен быть компактным").toBe(true);
    expect(/python/i.test(все), "не сказано, как это сделать вне JavaScript").toBe(true);
    // Путь через openssl — тот, которым воспользуется инженер ведомства.
    // Проверен на живом прод-документе: «Signature Verified Successfully».
    const oss = (v.openssl ?? []).join(" ");
    expect(oss.includes("pkeyutl"), "нет готовой команды openssl").toBe(true);
    expect(oss.includes("-rawin"), "команда openssl без -rawin не проверит Ed25519").toBe(true);
    // Соседний модуль платформы объявляет RFC 8785, и знакомый с ним инженер
    // применит её здесь — а у нас подписаны РОВНО пришедшие байты. Без прямой
    // оговорки он получит «подделка» на честном документе.
    expect(String(v.notRfc8785 ?? ""), "не сказано, что RFC 8785 здесь НЕ применяется").toContain("8785");
    expect(String(v.notRfc8785En ?? ""), "то же не сказано по-английски").toContain("8785");

    // И граница обещания названа: подпись не доказывает, что владелец — мы.
    expect(String(v.limit).length, "граница обещания не названа").toBeGreaterThan(50);
    expect(String(v.limitEn).length, "граница не названа по-английски").toBeGreaterThan(50);
  });

  test("рецепт ловит подделку: изменённый документ не проходит по шагам", async () => {
    // Рецепт — это обещание постороннему. Пока по нему не проверили ПОДДЕЛКУ,
    // он проверен только на честном случае, а это половина.
    const doc = await request(app())
      .post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: "astana" });
    const att = doc.body.attestation;
    const health = await request(app()).get("/api/qskyway/health");
    const key = crypto.createPublicKey({
      key: Buffer.from(String(health.body.signing.publicKey), "base64"),
      format: "der",
      type: "spki",
    });

    // Подделка ровно того рода, ради которой документ и подписывают: цифра,
    // которую человек понесёт регулятору, изменена в выгодную сторону.
    const tampered = { ...doc.body.document, cruiseAltM: 999 };

    // Шаг 2 рецепта: хэш обязан совпасть с заявленным — и не совпадает.
    const hash = crypto.createHash("sha256").update(JSON.stringify(tampered)).digest("hex");
    expect(hash, "подделка не изменила хэш — рецепт бесполезен").not.toBe(att.contentHash);

    // Шаг 3: подпись на байтах ПОДДЕЛАННОГО хэша не проверяется ключом службы.
    const ok = crypto.verify(null, Buffer.from(hash, "hex"), key, Buffer.from(att.signature, "base64"));
    expect(ok, "подпись сошлась на изменённом документе").toBe(false);

    // И наша собственная ручка обязана сказать то же самое — иначе рецепт и
    // сервис расходятся, а расхождение хуже отсутствия рецепта.
    const v = await request(app())
      .post("/api/qskyway/route/justification/verify")
      .send({ document: tampered, attestation: att });
    expect(v.status).toBe(200);
    expect(v.body.hashValid, "ручка не заметила подмену документа").toBe(false);
  });
});
