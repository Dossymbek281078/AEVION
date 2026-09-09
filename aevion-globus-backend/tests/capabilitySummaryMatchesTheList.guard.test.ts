import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter } from "../src/routes/devhub";
import { noteProviderFailure, noteProviderSuccess, __resetProviderHealth } from "../src/lib/providerHealth";

/**
 * Два наших собственных ответа об одном — в ОДНОМ ответе ручки.
 *
 * Замер прода 08.09.2026: `/api/devhub/studio/capabilities` отдавал список, где
 * needs_token одна возможность и not_available две, а в summary того же ответа
 * стояло needsToken: 3. Считалось остатком (всего − live − degraded), поэтому
 * втягивало любое незнакомое состояние.
 *
 * Следствие видел человек, и оно противоречило само себе в одном баннере:
 * /studio писал «⚙️ 3 capabilities need Railway env vars:», а список рядом
 * фильтрует по status === "needs_token" и показывал ОДНУ переменную. Заголовок
 * спорил со своим же списком, и «нужен ключ» обещало починку ключом там, где
 * ключ ни при чём: Railway не сделан, зона домена не делегирована.
 *
 * Второй сторож — про утечку. Ручка ПУБЛИЧНАЯ (проверено curl без ключа), и её
 * lastError уходит в подсказку на витрине. На проде там лежало сырое тело
 * ответа ElevenLabs с authentication_error и «провайдер-проба: HTTP 401».
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

beforeEach(() => __resetProviderHealth());
afterEach(() => {
  __resetProviderHealth();
  delete process.env.ELEVENLABS_API_KEY;
});

describe("сводка возможностей не спорит со своим списком", () => {
  test("needsToken считает ТОЛЬКО needs_token — как и список в баннере /studio", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    expect(r.status).toBe(200);
    const caps = r.body.capabilities as Array<{ status: string }>;
    const byStatus = (s: string) => caps.filter((c) => c.status === s).length;

    // Отношение, а не число: статусы зависят от окружения, а обязано совпадать
    // именно то, что человек видит рядом — заголовок и список под ним.
    expect(r.body.summary.needsToken, "заголовок баннера разошёлся со своим списком").toBe(byStatus("needs_token"));
    expect(r.body.summary.live).toBe(byStatus("live"));
    expect(r.body.summary.degraded).toBe(byStatus("degraded"));
  });

  test("not_available называется своим именем, а не «нужен ключ»", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const caps = r.body.capabilities as Array<{ status: string }>;
    const notAvailable = caps.filter((c) => c.status === "not_available").length;
    expect(r.body.summary.notAvailable, "поле пропало — остаток снова растворит не сделанное в «нужен ключ»").toBe(notAvailable);
    // Контроль прибора: в наборе такие возможности ЕСТЬ (railway, домен без
    // делегированной зоны), иначе проверка выше проходила бы на пустом месте.
    expect(notAvailable, "в наборе нет ни одной not_available — сторож стережёт пустоту").toBeGreaterThan(0);
  });

  test("сумма частей равна целому", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const s = r.body.summary;
    const caps = r.body.capabilities as Array<{ status: string }>;
    const other = caps.filter((c) => !["live", "degraded", "needs_token", "not_available"].includes(c.status)).length;
    expect(s.live + s.degraded + s.needsToken + s.notAvailable + other).toBe(s.total);
  });
});

describe("наружу уходит код причины, а не ответ поставщика", () => {
  test("сырое тело ответа поставщика вырезано, вместо него offCode", async () => {
    process.env.ELEVENLABS_API_KEY = "key-that-provider-rejects";
    noteProviderFailure(
      "audio_tts",
      'ElevenLabs HTTP 400: {"detail":{"type":"authentication_error","code":"invalid_api_key"}}',
    );

    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const tts = (r.body.capabilities as Array<Record<string, string>>).find((c) => c.id === "audio_tts");

    expect(tts?.status, "проба не доехала — сторож мерит не тот путь").toBe("degraded");
    expect(tts?.offCode, "причина обязана приезжать кодом: подсказка живёт в атрибуте, а его доводчик не переводит").toBe("auth_rejected");
    expect(JSON.stringify(r.body), "тело ответа поставщика ушло на публичную витрину").not.toContain("authentication_error");
    expect(JSON.stringify(r.body), "код HTTP поставщика ушёл на публичную витрину").not.toContain("HTTP 400");
  });

  test("исчерпанная квота отличается от отвергнутого ключа — это разные новости", async () => {
    process.env.ELEVENLABS_API_KEY = "valid-key-no-credit";
    noteProviderFailure("audio_tts", "provider says the quota is exhausted for this month");

    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const tts = (r.body.capabilities as Array<Record<string, string>>).find((c) => c.id === "audio_tts");
    expect(tts?.offCode).toBe("quota_exhausted");
  });

  test("у живой возможности кода причины нет вовсе", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const live = (r.body.capabilities as Array<Record<string, string>>).filter((c) => c.status === "live");
    expect(live.length, "контроль: живых возможностей нет — проверять нечего").toBeGreaterThan(0);
    for (const c of live) expect(c.offCode, `${c.id}: живая возможность несёт причину отказа`).toBeUndefined();
  });
});

describe("отказ ключа ломает всю группу, а не одну возможность", () => {
  test("отвергнутый ключ ElevenLabs понижает и озвучку, и музыку", async () => {
    process.env.ELEVENLABS_API_KEY = "key-id-pasted-instead-of-key";
    // Позвали ОДНУ — озвучку. Музыка на том же ключе, её никто не звал.
    noteProviderFailure("audio_tts", 'ElevenLabs HTTP 401: {"detail":{"type":"authentication_error"}}');

    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const by = (id: string) => (r.body.capabilities as Array<Record<string, string>>).find((c) => c.id === id);

    expect(by("audio_tts")?.status).toBe("degraded");
    expect(
      by("audio_music")?.status,
      "музыка на том же ключе объявлена живой — витрина обещает то, чего нет",
    ).toBe("degraded");
    expect(by("audio_music")?.offCode).toBe("auth_rejected");
  });

  test("отказ ВЫЗОВА (не ключа) на соседа не переносится", async () => {
    process.env.ELEVENLABS_API_KEY = "good-key";
    // Пятисотка поставщика — это про вызов: соседняя возможность может работать.
    noteProviderFailure("audio_tts", "provider-probe: HTTP 503");

    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const by = (id: string) => (r.body.capabilities as Array<Record<string, string>>).find((c) => c.id === id);
    expect(by("audio_tts")?.status).toBe("degraded");
    expect(by("audio_music")?.status, "разовый отказ вызова оклеветал соседа").toBe("live");
  });

  test("свой успех НОВЕЕ чужого отказа — понижения нет", async () => {
    process.env.ELEVENLABS_API_KEY = "key-fixed-midway";
    noteProviderFailure("audio_tts", "ElevenLabs authentication_error: invalid_api_key");
    await new Promise((r) => setTimeout(r, 5));
    noteProviderSuccess("audio_music");

    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const music = (r.body.capabilities as Array<Record<string, string>>).find((c) => c.id === "audio_music");
    expect(music?.status, "ключ починили, а витрина всё ещё жалуется").toBe("live");
  });

  test("возможность с ЦЕПОЧКОЙ поставщиков не понижается чужим отказом", async () => {
    // У картинок список токенов: OpenAI → Workers AI → Together. Падение одного
    // звена возможность не убивает, и понижать её было бы клеветой.
    process.env.OPENAI_API_KEY = "rejected";
    noteProviderFailure("screenshot_code", "authentication_error: invalid_api_key");

    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    const image = (r.body.capabilities as Array<Record<string, string>>).find((c) => c.id === "image");
    expect(image?.status === "degraded" && image?.offCode === "auth_rejected").toBe(false);
    delete process.env.OPENAI_API_KEY;
  });
});
