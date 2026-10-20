/*
 * 🔴 20.10.2026 22:1x, прод (волна 5, приёмка Оркестратора): гость с адреса X задал 2 вопроса,
 * зарегистрировался — и получил {"использовано":2,"осталось":0,"гость":false}; консилиум не ушёл.
 * Слой Мультичата стоит до всякой проверки входа (req.auth пуст), вошедший считался по ключам
 * гостя: адресу и устройству. Когда адрес от сайта стал настоящим, гость отнимал норму у вошедшего.
 * Условие: вошедший считается ТОЛЬКО по своему id; адрес и устройство — только для гостя.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const КЛЮЧ = "edge-key-for-tests-0123456789abcdef";
const АДРЕС = "178.91.246.196";
const prev = { edge: process.env.AEVION_EDGE_KEY, jwt: process.env.AUTH_JWT_SECRET };

beforeEach(async () => {
  process.env.AEVION_EDGE_KEY = КЛЮЧ;
  process.env.AUTH_JWT_SECRET = "test-secret-at-least-32-chars-long-aevion-000";
  (await import("../src/lib/multichatGuestPass")).сброситьСчётГостей();
});
afterEach(() => {
  if (prev.edge === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = prev.edge;
  if (prev.jwt === undefined) delete process.env.AUTH_JWT_SECRET; else process.env.AUTH_JWT_SECRET = prev.jwt;
});

const токен = (sub: string) => jwt.sign({ sub, email: `${sub}@example.test` }, process.env.AUTH_JWT_SECRET as string, { algorithm: "HS256" });

function запрос(устройство: string, sub?: string) {
  const headers: Record<string, string> = { "x-aevion-edge-key": КЛЮЧ, "x-aevion-client-ip": АДРЕС, "x-aevion-device": устройство };
  if (sub) headers.authorization = `Bearer ${токен(sub)}`;
  return { headers, get(h: string) { return headers[h.toLowerCase()]; }, body: {}, socket: { remoteAddress: "10.0.0.9" }, ip: "10.0.0.9" } as any;
}

async function остаток(устройство: string, sub?: string) {
  const m = await import("../src/lib/multichatGuestPass");
  const a = express();
  a.get("/api/multichat-guest/allowance", m.ручкаОстатка);
  let r = request(a).get("/api/multichat-guest/allowance")
    .set("x-aevion-edge-key", КЛЮЧ).set("x-aevion-client-ip", АДРЕС).set("x-aevion-device", устройство);
  if (sub) r = r.set("Authorization", `Bearer ${токен(sub)}`);
  return (await r).body as { лимит: number; использовано: number; осталось: number; гость: boolean };
}

describe("вошедшего не считают по адресу гостя", () => {
  test("🔴 мусорный или чужой Bearer — НЕ вошедший: считается гостем по адресу и устройству", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    m.засчитатьГостю(запрос("dev-A"));
    m.засчитатьГостю(запрос("dev-A"));
    const a = express();
    a.get("/api/multichat-guest/allowance", m.ручкаОстатка);
    const чужойКлюч = jwt.sign({ sub: "forged" }, "another-secret-at-least-32-chars-long-000", { algorithm: "HS256" });
    for (const bearer of ["x", "Bearer-garbage.not.jwt", чужойКлюч]) {
      const r = await request(a).get("/api/multichat-guest/allowance")
        .set("x-aevion-edge-key", КЛЮЧ).set("x-aevion-client-ip", АДРЕС).set("x-aevion-device", "dev-new-" + bearer.length)
        .set("Authorization", `Bearer ${bearer}`);
      expect(r.body.гость, bearer).toBe(true);
      expect(r.body.осталось, `${bearer}: подложенный Bearer дал свежую норму`).toBe(0);
    }
  });

  test("🔴 гость исчерпал адрес → новый вошедший с того же адреса получает свою полную норму", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    m.засчитатьГостю(запрос("dev-A"));
    m.засчитатьГостю(запрос("dev-A"));
    const вошедший = await остаток("dev-new", "user-fresh-1");
    expect(вошедший.гость).toBe(false);
    expect(вошедший.использовано).toBe(0);
    expect(вошедший.осталось).toBe(вошедший.лимит);
  });

  test("КОНТРОЛЬ: гость с нового устройства того же адреса по-прежнему получает 0", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    m.засчитатьГостю(запрос("dev-A"));
    m.засчитатьГостю(запрос("dev-A"));
    const гость = await остаток("dev-B");
    expect(гость.гость).toBe(true);
    expect(гость.осталось).toBe(0);
  });

  test("траты вошедшего идут на его id: гостю того же адреса не мешают, ему самому — да", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    m.засчитатьГостю(запрос("dev-U", "user-2"));
    m.засчитатьГостю(запрос("dev-U", "user-2"));
    expect((await остаток("dev-U", "user-2")).осталось).toBe(0);
    expect((await остаток("dev-other", "user-2")).осталось, "норма вошедшего привязана к id, не к устройству").toBe(0);
    expect((await остаток("dev-G")).осталось, "гость того же адреса не пострадал").toBe(2);
    expect((await остаток("dev-U", "user-3")).осталось, "другой вошедший на той же машине — своя норма").toBe(2);
  });
});
