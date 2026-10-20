/**
 * Остаток Мультичата: вошедший — не гость; адрес гостя от прокси сайта держит норму.
 *
 * ПОВОД (замер на проде 20.10.2026, put-multichat.mjs):
 *  1) вошедший пробный аккаунт получал от /api/multichat-guest/allowance «гость»:true —
 *     ручка висит на app мимо слоя авторизации, req.auth не заполнен;
 *  2) новое окно браузера с того же адреса снова получало 2 бесплатных вопроса:
 *     через rewrite /api-backend бэкенд видит адрес узла Vercel, IP-ключ нормы
 *     не держал. Прокси сайта присылает адрес гостя с секретом (AEVION_EDGE_KEY).
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));

const SECRET = "test-secret-multichat-allowance";
const EDGE = "edge-key-for-tests-0123456789";
process.env.AUTH_JWT_SECRET = SECRET;
process.env.AEVION_EDGE_KEY = EDGE;

const { ручкаОстатка, засчитатьГостю, сброситьСчётГостей } = await import("../src/lib/multichatGuestPass");

const app = () => {
  const a = express();
  a.get("/api/multichat-guest/allowance", ручкаОстатка);
  return a;
};
const токен = () => jwt.sign({ sub: "user-1", email: "u@example.org" }, SECRET, { algorithm: "HS256", expiresIn: "1h" });

/** Запрос «как через прокси сайта»: адрес гостя + секрет, своё устройство. */
function черезСайт(адрес: string, устройство: string, ключ = EDGE) {
  return { headers: { "x-aevion-edge-key": ключ, "x-aevion-client-ip": адрес, "x-aevion-device": устройство }, get(h: string) { return (this.headers as any)[h.toLowerCase()]; }, socket: { remoteAddress: "10.0.0.7" }, ip: "10.0.0.7" } as any;
}

describe("allowance: вошедший — не гость", () => {
  beforeEach(() => сброситьСчётГостей());

  test("с токеном — гость:false", async () => {
    const r = await request(app()).get("/api/multichat-guest/allowance").set("Authorization", `Bearer ${токен()}`);
    expect(r.status).toBe(200);
    expect(r.body.гость).toBe(false);
  });

  test("КОНТРОЛЬ: без токена и с мусорным токеном — гость:true", async () => {
    expect((await request(app()).get("/api/multichat-guest/allowance")).body.гость).toBe(true);
    expect((await request(app()).get("/api/multichat-guest/allowance").set("Authorization", "Bearer garbage.token.value")).body.гость).toBe(true);
  });
});

describe("норма гостя: адрес от прокси сайта", () => {
  beforeEach(() => сброситьСчётГостей());

  test("новое устройство с ТОГО ЖЕ адреса получает исчерпанную норму", async () => {
    засчитатьГостю(черезСайт("178.91.246.196", "dev-A"));
    засчитатьГостю(черезСайт("178.91.246.196", "dev-A"));
    const r = await request(app())
      .get("/api/multichat-guest/allowance")
      .set("x-aevion-edge-key", EDGE).set("x-aevion-client-ip", "178.91.246.196").set("x-aevion-device", "dev-B");
    expect(r.body.осталось).toBe(0);
  });

  test("КОНТРОЛЬ: другой адрес и другое устройство — норма целая", async () => {
    засчитатьГостю(черезСайт("178.91.246.196", "dev-A"));
    засчитатьГостю(черезСайт("178.91.246.196", "dev-A"));
    const r = await request(app())
      .get("/api/multichat-guest/allowance")
      .set("x-aevion-edge-key", EDGE).set("x-aevion-client-ip", "95.56.1.2").set("x-aevion-device", "dev-C");
    expect(r.body.осталось).toBe(2);
  });

  test("чужой секрет — адрес из заголовка не принимается (подделать норму соседа нельзя)", async () => {
    засчитатьГостю(черезСайт("178.91.246.196", "dev-A"));
    засчитатьГостю(черезСайт("178.91.246.196", "dev-A"));
    const r = await request(app())
      .get("/api/multichat-guest/allowance")
      .set("x-aevion-edge-key", "wrong-edge-key-0123456789").set("x-aevion-client-ip", "178.91.246.196").set("x-aevion-device", "dev-D");
    expect(r.body.осталось).toBe(2);
  });
});
