import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { qskywayRouter } from "../src/routes/qskyway.js";

/**
 * Авторство редакции правил ПРОВЕРЯЕМО посторонним — байтами, не вердиктом.
 *
 * Замер 06.09.2026 на проде: подпись Ed25519 вычислялась signAirspace(), но
 * ни одна поверхность её не отдавала — /verify возвращал только `valid`,
 * посчитанный НАШИМ ЖЕ сервером. Это самосогласованность, а не заверение
 * (класс feedback_self_consistency_is_not_attestation): свой вердикт о своей
 * подписи может показать кто угодно.
 *
 * Тест повторяет постороннего: берёт signature+publicKey+contentHash из
 * ответа и проверяет их НАСТОЯЩИМ crypto.verify, серверному `valid` не веря.
 * Контроль в обе стороны: подпорченная подпись обязана перестать сходиться —
 * иначе проверка была бы пустой формой.
 */

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/qskyway", qskywayRouter);
  return app;
}

describe("авторство редакции проверяемо байтами", () => {
  test("/verify отдаёт подпись, и она сходится настоящим Ed25519-verify", async () => {
    const r = await request(приложение()).get("/api/qskyway/verify?city=nyc");
    expect(r.status).toBe(200);
    const a = r.body.airspace;
    expect(a?.attested, "у nyc обязан быть фид регулятора — иначе тест не про то").toBe(true);
    expect(typeof a.signature, "подписи нет — посторонний снова получает голый вердикт").toBe("string");
    expect(typeof a.publicKey).toBe("string");
    expect(a.alg).toBe("Ed25519");

    const ok = crypto.verify(
      null,
      Buffer.from(a.contentHash, "hex"),
      crypto.createPublicKey({ key: Buffer.from(a.publicKey, "base64"), format: "der", type: "spki" }),
      Buffer.from(a.signature, "base64"),
    );
    expect(ok, "подпись не сходится с contentHash — отдаём мусор вместо заверения").toBe(true);

    // Отрицательный контроль: испорченная подпись НЕ сходится. Без него
    // verify, возвращающий true на всё, прошёл бы «проверку».
    const испорченная = Buffer.from(a.signature, "base64");
    испорченная[0] ^= 0xff;
    const плохой = crypto.verify(
      null,
      Buffer.from(a.contentHash, "hex"),
      crypto.createPublicKey({ key: Buffer.from(a.publicKey, "base64"), format: "der", type: "spki" }),
      испорченная,
    );
    expect(плохой, "проверка не отличает подпись от мусора").toBe(false);
  });

  test("рецепт редакции называет и авторство, и правильный метод якоря", async () => {
    const r = await request(приложение()).get("/api/qskyway/airspace/edition?city=nyc");
    expect(r.status).toBe(200);
    const шаги = (r.body.verifyYourself?.steps ?? []).join("\n");
    expect(шаги, "в рецепте нет шага про авторство").toContain("Ed25519-verify");
    // Прежний текст говорил GET, обе ручки якоря — POST: посторонний по
    // рецепту получал 404 (замер соседнего окна 06.09.2026).
    expect(шаги, "рецепт снова шлёт постороннего GET-ом на POST-ручку").not.toMatch(/GET \/api\/qskyway\/airspace\/anchor/);
  });
});
