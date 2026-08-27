import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Треки QMedia переживают перезапуск.
 *
 * Замер 27–28.08.2026, тремя независимыми способами:
 *   · в routes/qmedia.ts было НОЛЬ вызовов pool.query на 31 маршрут;
 *   · четыре таблицы создавались при старте, и ни одну модуль не запрашивал;
 *   · прод: /api/qmedia/health перечислял все четыре таблицы, а /tracks и
 *     /videos отдавали пустые списки.
 *
 * То есть модуль за $15/мес (medium, full, enterprise; статус live) терял
 * загруженное при каждой выкатке — а их бывает несколько за сутки. Схема была
 * написана полностью и правильно, её просто не подключили.
 */

const tracks = new Map<string, Record<string, unknown>>();

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      const p = (params ?? []) as unknown[];
      const head = s.trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER") || head.startsWith("SELECT 1")) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('INSERT INTO "QMediaTrack"')) {
        tracks.set(String(p[0]), {
          id: p[0], userId: p[1], title: p[2], artist: p[3], genre: p[4], duration: p[5],
          url: p[6], coverUrl: p[7], lyrics: p[8], playCount: p[9], isPublic: p[10],
          tags: p[11], createdAt: p[12], updatedAt: p[13],
        });
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('DELETE FROM "QMediaTrack"')) {
        const t = tracks.get(String(p[0]));
        if (!t || t.userId !== p[1]) return { rows: [], rowCount: 0 };
        tracks.delete(String(p[0]));
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('UPDATE "QMediaTrack"') && s.includes('"playCount" + 1')) {
        const t = tracks.get(String(p[0]));
        if (!t) return { rows: [], rowCount: 0 };
        t.playCount = Number(t.playCount) + 1;
        return { rows: [{ playCount: t.playCount }], rowCount: 1 };
      }
      if (s.includes('FROM "QMediaTrack"')) {
        let rows = [...tracks.values()];
        if (s.includes('"id" = $1')) rows = rows.filter((r) => r.id === p[0]);
        else if (s.includes('"userId" = $1')) rows = rows.filter((r) => r.userId === p[0]);
        else if (s.includes('"isPublic" = TRUE')) rows = rows.filter((r) => r.isPublic === true);
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureQMediaTables", () => ({
  ensureQMediaTables: async () => {},
  isQMediaDbReady: () => true,
  getQMediaDbError: () => null,
}));

import { qmediaRouter } from "../src/routes/qmedia";

const TOKEN = jwt.sign({ sub: "author-1" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qmediaRouter);
  return a;
}

describe("треки QMedia переживают перезапуск", () => {
  test("загруженный трек ложится в базу, а не в память процесса", async () => {
    const before = tracks.size;
    const res = await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Первый трек", artist: "AEVION", genre: "ambient", isPublic: true });
    expect(res.status, `трек не создан: ${JSON.stringify(res.body)}`).toBe(201);
    // Прирост, а не «больше нуля»: соседний случай уже мог положить строку.
    expect(tracks.size, "трек не доехал до базы — исчезнет при выкатке").toBe(before + 1);
  });

  test("мои треки читаются из базы — и ТОЛЬКО мои", async () => {
    await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Мой трек", isPublic: false });
    const stranger = jwt.sign({ sub: "stranger-7" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });
    await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${stranger}`)
      .send({ title: "Чужой трек", isPublic: false });

    const res = await request(app()).get("/x/me/tracks").set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    const titles = res.body.items.map((t: { title: string }) => t.title);
    expect(titles).toContain("Мой трек");
    // Без этого утверждения выборка «мои» могла отдавать ВСЁ подряд, и подмена
    // условия по владельцу проходила молча — поймано мутацией.
    expect(titles, "в «мои треки» попал чужой").not.toContain("Чужой трек");
  });

  test("публичный список отдаёт только публичные", async () => {
    const res = await request(app()).get("/x/tracks");
    expect(res.status).toBe(200);
    const titles = res.body.items.map((t: { title: string }) => t.title);
    expect(titles).toContain("Первый трек");
    expect(titles, "черновик виден посторонним").not.toContain("Мой трек");
  });

  test("прослушивание считается В БАЗЕ", async () => {
    const created = await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Считаем показы", isPublic: true });
    const id = created.body.id as string;
    const first = await request(app()).post(`/x/tracks/${id}/play`);
    expect(first.status).toBe(200);
    expect(first.body.playCount).toBe(1);
    expect(tracks.get(id)?.playCount, "счётчик вырос только на экране").toBe(1);
  });

  test("удаление доходит до базы и чужое не трогает", async () => {
    const created = await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "На удаление" });
    const id = created.body.id as string;

    const stranger = jwt.sign({ sub: "stranger-9" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });
    const alien = await request(app()).delete(`/x/me/tracks/${id}`).set("Authorization", `Bearer ${stranger}`);
    expect(alien.status, "посторонний удалил чужой трек").toBe(404);
    expect(tracks.has(id), "чужой трек всё-таки исчез").toBe(true);

    const mine = await request(app()).delete(`/x/me/tracks/${id}`).set("Authorization", `Bearer ${TOKEN}`);
    expect(mine.status).toBe(200);
    expect(tracks.has(id), "удаление не дошло до базы").toBe(false);
  });

  test("производные выборки видят треки из базы, а не пустоту", async () => {
    // Пять маршрутов (тренды, радио, похожие, рекомендации, умный плейлист)
    // читали память процесса. После перевода записи в базу они отдавали бы
    // пустоту всегда — это была бы не починка, а размен одной беды на другую.
    const res = await request(app()).get("/x/trending");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body, "тренды не видят треков из базы").toContain("Первый трек");
  });
});
