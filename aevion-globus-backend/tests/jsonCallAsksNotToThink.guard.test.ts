import { describe, test, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";

/**
 * Вызов, который ждёт JSON, обязан просить модель не размышлять.
 *
 * Повод 07.10.2026. У `gemini-2.5-flash` внутреннее размышление тратит тот же
 * бюджет, что и ответ. Для свободного текста обрыв даёт неполный, но читаемый
 * ответ; для JSON обрыв означает, что ответ не разберётся ВООБЩЕ и модуль
 * отдаст ошибку вместо результата.
 *
 * Перевод вакансии просит 2200 токенов — выше порога «маленького бюджета»
 * (2048), поэтому общее правило его не покрывает. Признак задан по СМЫСЛУ
 * задачи: `structured: true`.
 *
 * 🔴 Этот сторож появился потому, что мутация «снять `structured: true` с
 * вызова» ПРОШЛА насквозь: проверки были только на помощника, а на сам вызов
 * — ни одной. Тест охранял не то, что обещал.
 */

process.env.NODE_ENV = "test";
// Настроен ТОЛЬКО Gemini: ключа Anthropic намеренно нет — так проверяется, что
// модуль после перевода на реестр больше не требует именно его.
process.env.GEMINI_API_KEY = "test-gemini";
delete process.env.ANTHROPIC_API_KEY;

const { вызовы } = vi.hoisted(() => ({ вызовы: [] as Array<Record<string, unknown>> }));

vi.mock("../src/lib/build/ai", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return {
    ...настоящий,
    callClaude: vi.fn(async (opts: Record<string, unknown>) => {
      вызовы.push(opts);
      return {
        text: JSON.stringify({ translations: { en: { title: "T", description: "D" } } }),
        inputTokens: 0,
        outputTokens: 0,
      };
    }),
  };
});
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { aiRouter } = await import("../src/routes/build/ai");

/**
 * Ручка закрыта входом (`requireBuildAuth`). Токен подписывается тем же
 * умолчанием секрета, что берёт `src/lib/authJwt.ts` вне прода.
 * base64url берётся у Node, чтобы в тесте не заводить своих замен символов.
 */
function токен(sub = "guard-json", role = "USER") {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, email: sub + "@test.aev", role, iat: Math.floor(Date.now() / 1000) });
  const sig = crypto.createHmac("sha256", "dev-auth-secret").update(head + "." + body).digest("base64url");
  return "Bearer " + head + "." + body + "." + sig;
}

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/build/ai", aiRouter);
  return a;
}

describe("перевод вакансии: JSON без размышления", () => {
  beforeEach(() => { вызовы.length = 0; });

  test("🔴 вызов помечен структурным", async () => {
    const r = await request(приложение())
      .post("/api/build/ai/translate-vacancy")
      .set("Authorization", токен())
      .send({
        title: "Сварщик на объект",
        description: "Требуется сварщик с опытом работы на высотных объектах не менее трёх лет.",
        targetLocales: ["en"],
      });

    expect([200, 201], `ручка ответила ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`).toContain(r.status);
    expect(вызовы.length, "модель вообще не позвали — проверять нечего").toBe(1);
    expect(
      вызовы[0].structured,
      "с JSON-вызова сняли признак структурного ответа: обрыв сделает ответ неразбираемым",
    ).toBe(true);
  });

  test("контроль: бюджет остался прежним, признак его не подменяет", async () => {
    // Признак и бюджет — разные вещи. Если бы правка «чинила» обрыв
    // уменьшением бюджета, длинная вакансия начала бы обрезаться по-другому.
    //
    // Вызов делается СВОЙ: первая версия этого контроля читала след прошлого
    // теста, а `beforeEach` его чистит — проверялся порядок хуков, не бюджет.
    await request(приложение())
      .post("/api/build/ai/translate-vacancy")
      .set("Authorization", токен())
      .send({
        title: "Сварщик на объект",
        description: "Требуется сварщик с опытом работы на высотных объектах не менее трёх лет.",
        targetLocales: ["en"],
      });
    expect(вызовы.length, "модель не позвали — контроль проверять не на чем").toBe(1);
    expect(вызовы[0].maxTokens).toBe(2200);
  });
});
