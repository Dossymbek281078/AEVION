import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter } from "../src/routes/devhub";
import { noteProviderFailure, __resetProviderHealth } from "../src/lib/providerHealth";

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
