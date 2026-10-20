/**
 * Ключа AEVION_EDGE_KEY нет — гость Мультичата всё равно получает свою норму.
 *
 * Требование Оркестратора 20.10.2026 к партии 52aeef55b: если ключ не задан, гость
 * должен видеть прежний счёт по устройству — не 0 вопросов и не 5xx — и в журнале
 * должна появиться строка (одна на процесс), а не тишина.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));

let warn: ReturnType<typeof vi.spyOn>;
const prevKey = process.env.AEVION_EDGE_KEY;

beforeEach(() => {
  vi.resetModules();
  delete process.env.AEVION_EDGE_KEY;
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  if (prevKey === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = prevKey;
});

async function поднять() {
  const m = await import("../src/lib/multichatGuestPass");
  const a = express();
  a.get("/api/multichat-guest/allowance", m.ручкаОстатка);
  return { a, m };
}
const спросить = (a: express.Express, устройство: string) =>
  request(a).get("/api/multichat-guest/allowance")
    .set("x-aevion-client-ip", "178.91.246.196").set("x-aevion-device", устройство);

describe("ключа нет", () => {
  test("гость получает полную норму (не 0) и 200, а не 5xx", async () => {
    const { a } = await поднять();
    const r = await спросить(a, "dev-1");
    expect(r.status).toBe(200);
    expect(r.body.гость).toBe(true);
    expect(r.body.осталось).toBe(2);
  });

  test("счёт по устройству работает как раньше: потраченное устройством видно ему же", async () => {
    const { a, m } = await поднять();
    const req = { headers: { "x-aevion-device": "dev-2" }, get(h: string) { return (this.headers as any)[h.toLowerCase()]; }, socket: { remoteAddress: "10.1.1.1" }, ip: "10.1.1.1" } as any;
    m.засчитатьГостю(req);
    m.засчитатьГостю(req);
    expect((await спросить(a, "dev-2")).body.осталось).toBe(0);
  });

  test("в журнале одна строка о том, что адреса от сайта нет — на несколько запросов", async () => {
    const { a } = await поднять();
    await спросить(a, "dev-3");
    await спросить(a, "dev-4");
    await спросить(a, "dev-5");
    const строки = warn.mock.calls.filter((c) => String(c[0]).includes("адрес гостя от сайта не пришёл"));
    expect(строки).toHaveLength(1);
  });

  test("подложенный заголовок адреса без ключа не принимается", async () => {
    const { a, m } = await поднять();
    // норма, потраченная на «чужой» адрес из заголовка, не должна списаться с этого гостя
    const чужой = { headers: { "x-aevion-client-ip": "178.91.246.196", "x-aevion-device": "dev-other" }, get(h: string) { return (this.headers as any)[h.toLowerCase()]; }, socket: { remoteAddress: "10.9.9.9" }, ip: "10.9.9.9" } as any;
    m.засчитатьГостю(чужой);
    m.засчитатьГостю(чужой);
    expect((await спросить(a, "dev-6")).body.осталось).toBe(2);
  });
});
