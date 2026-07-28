import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * У трека есть статус: `pending` (не прошёл модерацию), `published`, `flagged`
 * (снят модерацией). Список отдаёт только опубликованные —
 * `const conditions = ["status = 'published'"]`. А выдача по идентификатору не
 * смотрела на статус вовсе, ни на пути через базу, ни на пути через память.
 *
 * То есть трек, снятый модерацией, продолжал читаться по прямой ссылке. Решение
 * модерации соблюдалось в одном месте и игнорировалось в другом — тот же
 * перекос, что с непубличным постом в QSocial часом ранее.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { voiceOfEarthRouter } from "../src/routes/voiceOfEarth";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/voice-of-earth", voiceOfEarthRouter);
  return app;
}

/** База отвечает так, будто фильтр по статусу работает на её стороне. */
function serveTrack(status: string) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    const q = String(sql);
    if (q.includes("FROM voe_tracks") && q.includes("WHERE id =")) {
      const published = q.includes("status = 'published'");
      // Строку отдаём только если запрос сам её и просил
      if (published && status !== "published") return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            id: 1,
            title: "Песня",
            artist_alias: "Автор",
            language: "ru",
            lyrics: "текст",
            mood: "hopeful",
            audio_url: null,
            votes: 0,
            status,
            created_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

const get = () => request(makeApp()).get("/api/voice-of-earth/tracks/1");

describe("VoiceOfEarth: по ссылке открывается только опубликованный трек", () => {
  beforeEach(() => mockQuery.mockReset());

  test("запрос сам ограничен статусом, а не надеется на вызывающего", async () => {
    serveTrack("published");
    await get();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).find((q) => q.includes("WHERE id ="));
    expect(sql, "запрос к треку не найден").toBeTruthy();
    expect(sql).toContain("status = 'published'");
    expect(sql).not.toMatch(/SELECT\s+\*/i);
  });

  test("опубликованный трек отдаётся", async () => {
    serveTrack("published");
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.track.title).toBe("Песня");
  });

  test("снятый модерацией не отдаётся", async () => {
    serveTrack("flagged");
    expect((await get()).status).toBe(404);
  });

  test("не прошедший модерацию не отдаётся", async () => {
    serveTrack("pending");
    expect((await get()).status).toBe(404);
  });
});
