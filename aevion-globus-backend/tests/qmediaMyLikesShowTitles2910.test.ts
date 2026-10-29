import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/*
 * 29.10.2026 (окно «Приложения»): GET /api/qmedia/me/likes отдавал только {type,id} — страница
 * /qmedia/likes рисовала понравившееся без названия. Теперь — сам трек/видео; удалённое и чужое
 * закрытое не отдаётся (лайк по угаданному id не раскрывает название закрытого трека).
 */
const лайки = vi.fn();
const трек = vi.fn();
const видео = vi.fn();
vi.mock("../src/lib/ensureQMediaTables", () => ({ ensureQMediaTables: async () => {}, isQMediaDbReady: () => true, getQMediaDbError: () => null }));
vi.mock("../src/lib/qmediaStore", async (orig) => ({
  ...(await orig<typeof import("../src/lib/qmediaStore")>()),
  listMyLikes: (...a: unknown[]) => лайки(...a),
  getTrack: (...a: unknown[]) => трек(...a),
  getVideo: (...a: unknown[]) => видео(...a),
}));

// eslint-disable-next-line import/first
import { qmediaRouter } from "../src/routes/qmedia";
// eslint-disable-next-line import/first
import { getJwtSecret } from "../src/lib/authJwt";

const Я = "user-me";
const TOKEN = jwt.sign({ sub: Я }, getJwtSecret(), { algorithm: "HS256", expiresIn: "1h" });
const app = () => { const a = express(); a.use(express.json()); a.use("/api/qmedia", qmediaRouter); return a; };
const T = (id: string, userId: string, isPublic: boolean) => ({ id, userId, isPublic, title: `трек ${id}`, artist: "smoke", url: "https://example.com/a.mp3", genre: "pop" });

beforeEach(() => {
  лайки.mockReset(); трек.mockReset(); видео.mockReset();
  лайки.mockResolvedValue({ rows: [
    { type: "track", id: "мой-закрытый" }, { type: "track", id: "чужой-открытый" }, { type: "track", id: "чужой-закрытый" },
    { type: "track", id: "удалён" }, { type: "video", id: "в1" },
  ], failed: false });
  трек.mockImplementation(async (id: string) => ({ failed: false, track: {
    "мой-закрытый": T("мой-закрытый", Я, false), "чужой-открытый": T("чужой-открытый", "other", true), "чужой-закрытый": T("чужой-закрытый", "other", false),
  }[id] ?? null }));
  видео.mockResolvedValue({ failed: false, video: { id: "в1", userId: "other", isPublic: true, title: "видео в1", url: "https://example.com/v.mp4", category: "other" } });
});

describe("QMedia /me/likes: понравившееся с названиями", () => {
  test("знаменатель: 5 лайков → 3 видимых с названием (свой закрытый, чужой открытый, видео); чужой закрытый и удалённый — нет", async () => {
    const r = await request(app()).get("/api/qmedia/me/likes").set("Authorization", `Bearer ${TOKEN}`);
    expect(r.status).toBe(200);
    process.stderr.write(`знаменатель: лайков 5, в выдаче ${r.body.items.length}\n`);
    expect(r.body.items.map((i: { type: string; id: string; title: string }) => `${i.type}:${i.id}:${i.title}`)).toEqual([
      "track:мой-закрытый:трек мой-закрытый", "track:чужой-открытый:трек чужой-открытый", "video:в1:видео в1",
    ]);
  });

  test("отказ хранилища при чтении трека — отказ (503), а не урезанный список", async () => {
    трек.mockResolvedValue({ failed: true, track: null });
    const r = await request(app()).get("/api/qmedia/me/likes").set("Authorization", `Bearer ${TOKEN}`);
    expect(r.status).toBeGreaterThanOrEqual(500);
  });

  test("гость — 401", async () => {
    expect((await request(app()).get("/api/qmedia/me/likes")).status).toBe(401);
  });
});
