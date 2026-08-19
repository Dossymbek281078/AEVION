import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// Ручки, которые тратят деньги, ограничены. 19.08.2026.
//
// Замер: у голосового коуча не было НИ ОДНОГО ограничителя, ни квоты, ни
// проверки доступа — при том что /comment и /ask идут в платную модель, а /tts
// и /broadcast в платный синтез речи. Каждый вызов это счёт от провайдера, и
// утекает он тихо: ни падения, ни следа.
//
// Почему общий сторож дорогих ручек этого не поймал: его шаблон требует ДВОЙНЫХ
// кавычек вокруг пути, а здесь пути в одинарных. По репозиторию: 506
// объявлений он видит, 7 нет — и пять из семи именно здесь.

vi.hoisted(() => { process.env.DATABASE_URL = ""; });

async function приложение() {
  const router = (await import("../src/routes/cyberchessVoiceCoach")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-voice-coach", router);
  return a;
}

describe("дорогие ручки коуча ограничены", () => {
  test("поток запросов к /tts упирается в предел", async () => {
    const a = await приложение();
    const коды: number[] = [];
    for (let i = 0; i < 14; i++) {
      const r = await request(a).post("/api/cyberchess-voice-coach/tts").send({ text: "проверка" });
      коды.push(r.status);
    }
    // Ограничитель — потолок, а не стена: первые проходят.
    expect(коды.filter((c) => c === 429).length, "предел не сработал").toBeGreaterThan(0);
    expect(коды[0], "первый запрос не должен отбиваться").not.toBe(429);
  });

  test("отказ говорит, когда можно снова", async () => {
    // Молчаливый отказ заставляет клиента долбить в цикле — это и есть способ
    // получить счёт от провайдера вместо защиты от него.
    const a = await приложение();
    let последний: any = null;
    for (let i = 0; i < 26; i++) {
      последний = await request(a).post("/api/cyberchess-voice-coach/tts").send({ text: "x" });
      if (последний.status === 429) break;
    }
    expect(последний.status).toBe(429);
    expect(последний.body.error).toBe("rate_limited");
    expect(Number(последний.body.retryAfterSec)).toBeGreaterThan(0);
    expect(последний.headers["retry-after"]).toBeTruthy();
  });
});
