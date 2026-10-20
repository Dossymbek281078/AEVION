import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: треки-примеры Voice of Earth помечены и в счёт «треков» не входят.
 *
 * 🔴 Замер прода 20.10.2026: все 8 треков каталога — начальные примеры (одна секунда
 * 14.05, звука ни у одного, авторы выдуманы), а страница писала «8 треков всего» и
 * «только реальные люди и реальные голоса». Тот же класс, что проекты-образцы QBuild.
 */
vi.mock("../src/lib/ensureVoiceOfEarthTables", () => ({ ensureVoiceOfEarthTables: async () => {}, isVoiceOfEarthDbReady: () => false }));
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { voiceOfEarthRouter } = await import("../src/routes/voiceOfEarth");
const { VOICE_OF_EARTH_SEED } = await import("../src/data/voiceOfEarthSeed");
const app = express();
app.use(express.json());
app.use("/api/voice-of-earth", voiceOfEarthRouter);

describe("Voice of Earth: примеры отдельно от треков людей", () => {
  it("каждый начальный трек помечен example и в счёт не идёт", async () => {
    const список = await request(app).get("/api/voice-of-earth/tracks?limit=100");
    const примеры = список.body.items.filter((t: { example?: boolean }) => t.example);
    expect(примеры.length).toBe(VOICE_OF_EARTH_SEED.length);
    const стат = await request(app).get("/api/voice-of-earth/stats");
    expect(стат.body.total, "примеры посчитаны как треки людей").toBe(0);
    expect(стат.body.examples).toBe(VOICE_OF_EARTH_SEED.length);
    expect(стат.body.byLanguage).toEqual({});
    expect(стат.body.topTracks).toEqual([]);
  });

  it("трек, поданный человеком, — не пример и входит в счёт", async () => {
    const подан = await request(app).post("/api/voice-of-earth/tracks").send({
      title: "Песня степи", artistAlias: "Алия", language: "kk", mood: "hopeful", lyrics: "Дала кең, жүрек кең.",
    });
    expect(подан.status).toBeLessThan(300);
    const id = подан.body.track?.id ?? подан.body.id;
    const один = await request(app).get(`/api/voice-of-earth/tracks/${id}`);
    expect(один.body.track.example).toBe(false);
    const стат = await request(app).get("/api/voice-of-earth/stats");
    expect(стат.body.total).toBe(1);
    expect(стат.body.byLanguage).toEqual({ kk: 1 });
  });

  it("одно название без того же автора — не пример (ключ — пара)", async () => {
    const { трекПример } = await import("../src/data/voiceOfEarthSeed");
    expect(трекПример({ title: VOICE_OF_EARTH_SEED[0].title, artist_alias: "Другой автор" })).toBe(false);
    expect(трекПример({ title: VOICE_OF_EARTH_SEED[0].title, artist_alias: VOICE_OF_EARTH_SEED[0].artistAlias })).toBe(true);
  });
});
