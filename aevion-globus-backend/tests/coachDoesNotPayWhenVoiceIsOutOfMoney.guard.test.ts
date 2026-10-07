import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";

/**
 * КОУЧ НЕ ПЛАТИТ ЗА ГОЛОС, КОГДА ЗНАКИ КОНЧИЛИСЬ.
 *
 * 🔴 Повод 06.10.2026. Коуч звал ElevenLabs слепо: при отказе отдавал код поставщика и
 * `reason: upstream_error`, то есть снаружи это неотличимо от нашей поломки, а деньги
 * за заведомо неудачный вызов уже списаны. При этом остаток знаков виден в БЕСПЛАТНОЙ
 * ручке подписки, и исчерпанный пакет приходит с HTTP 200 — поэтому разбор для
 * ElevenLabs в providerSpendCheck свой, а общий классификатор сказал бы «ok».
 *
 * Второе, что чинится: возможность продолжала числиться живой. Теперь отказ попадает в
 * providerHealth, как это уже делает панель DevHub («замкнуть петлю честности»).
 *
 * Проверяется ПОВЕДЕНИЕ через запрос к ручке, и главное утверждение — денежное:
 * платный адрес не вызван ни разу.
 */

process.env.ELEVENLABS_API_KEY = "test-key-not-real";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { default: router } = await import("../src/routes/cyberchessVoiceCoach");
const { забытьКэш } = await import("../src/lib/providerSpendCheck");
const { getProviderHealth, __resetProviderHealth } = await import("../src/lib/providerHealth");

const ПЕРЕВОД = String.fromCharCode(10); // эскейп съедается на границе вызова (§2е)
const ПЛАТНЫЙ = "text-to-speech";
const ПОДПИСКА = "user/subscription";

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-voice-coach", router);
  return a;
}

/** Подменяем сеть: отвечаем на бесплатную ручку подписки, считаем платные вызовы. */
function сеть(остатокЗнаков: number) {
  const адреса: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      адреса.push(u);
      if (u.includes(ПОДПИСКА)) {
        // Исчерпанный пакет приходит с HTTP 200 — в этом и соль.
        return new Response(
          JSON.stringify({ character_count: 100000 - остатокЗнаков, character_limit: 100000 }),
          { status: 200 },
        );
      }
      return new Response(Buffer.from("audio"), { status: 200 });
    }),
  );
  return адреса;
}

beforeEach(() => {
  забытьКэш();
  __resetProviderHealth();
  vi.unstubAllGlobals();
});
afterAll(() => vi.unstubAllGlobals());

describe("голос коуча: деньги спрашиваются ДО платного вызова", () => {
  test("знаки кончились — отказ 503 и платный адрес НЕ вызван", async () => {
    const адреса = сеть(0);
    const ответ = await request(приложение())
      .post("/api/cyberchess-voice-coach/tts")
      .send({ text: "Проверка озвучки", voiceId: "test-voice" });

    const платных = адреса.filter((u) => u.includes(ПЛАТНЫЙ)).length;
    process.stderr.write(
      `[сторож] обращений всего ${адреса.length}, платных ${платных}, код ответа ${ответ.status}` + ПЕРЕВОД,
    );
    expect(платных, "мы заплатили за голос при кончившихся знаках").toBe(0);
    expect(ответ.status, "отказ должен быть 503: кончившиеся знаки — наша беда, не ошибка запроса").toBe(503);
    expect(ответ.body?.error).toBe("voice_unavailable");
    expect(ответ.body?.state, "состояние не названо — снаружи не отличить от поломки").toBe("нет денег");
    expect(
      getProviderHealth("audio_tts"),
      "возможность продолжает числиться живой — петля честности не замкнута",
    ).toBeTruthy();
  });

  test("КОНТРОЛЬ: знаки есть — платный вызов происходит и успех отмечен", async () => {
    // Без этого случая первая проверка проходила бы и на коде, который НИКОГДА не
    // озвучивает: «не заплатили» легко получить, сломав озвучку целиком.
    const адреса = сеть(50000);
    const ответ = await request(приложение())
      .post("/api/cyberchess-voice-coach/tts")
      .send({ text: "Проверка озвучки", voiceId: "test-voice" });

    const платных = адреса.filter((u) => u.includes(ПЛАТНЫЙ)).length;
    process.stderr.write(`[сторож] контроль: платных ${платных}, код ${ответ.status}` + ПЕРЕВОД);
    expect(платных, "знаки есть, а платный вызов не состоялся — голос сломан").toBeGreaterThanOrEqual(1);
    expect(ответ.status, "при живом остатке ручка обязана отвечать 200").toBe(200);
  });

  test("бесплатная ручка подписки спрашивается ОДИН раз на два вызова (кэш)", async () => {
    const адреса = сеть(50000);
    const app = приложение();
    await request(app).post("/api/cyberchess-voice-coach/tts").send({ text: "раз", voiceId: "v" });
    await request(app).post("/api/cyberchess-voice-coach/tts").send({ text: "два", voiceId: "v" });
    const подписки = адреса.filter((u) => u.includes(ПОДПИСКА)).length;
    process.stderr.write(`[сторож] обращений к бесплатной ручке: ${подписки}` + ПЕРЕВОД);
    // Кэш общий с проверкой расхода: второй вызов не должен ходить к поставщику снова.
    expect(подписки, "к бесплатной ручке ходим на каждую озвучку — кэш не работает").toBe(1);
  });
});
