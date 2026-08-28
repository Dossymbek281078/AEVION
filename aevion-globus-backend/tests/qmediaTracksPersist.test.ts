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
const playlists = new Map<string, Record<string, unknown>>();
const videos = new Map<string, Record<string, unknown>>();
const likes = new Set<string>();

/**
 * Стенд обязан отдавать КОПИИ, как настоящая база.
 *
 * Пока он отдавал те же объекты, что хранил, правка в маршруте меняла
 * «базу» напрямую — и мутация «сохранение убрано» проходила молча: данные
 * всё равно оказывались на месте. Настоящий Postgres так не делает, и тест,
 * который этого не воспроизводит, стережёт не то.
 */
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      const p = (params ?? []) as unknown[];
      const head = s.trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER") || head.startsWith("SELECT 1")) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('INSERT INTO "QMediaVideo"')) {
        videos.set(String(p[0]), {
          id: p[0], userId: p[1], title: p[2], description: p[3], url: p[4],
          thumbnailUrl: p[5], duration: p[6], viewCount: p[7], isPublic: p[8],
          category: p[9], tags: p[10], createdAt: p[11], updatedAt: p[12],
        });
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('UPDATE "QMediaVideo"') && s.includes('"viewCount" + 1')) {
        const v = videos.get(String(p[0]));
        if (!v) return { rows: [], rowCount: 0 };
        v.viewCount = Number(v.viewCount) + 1;
        return { rows: [{ viewCount: v.viewCount }], rowCount: 1 };
      }
      if (s.includes('DELETE FROM "QMediaVideo"')) {
        const v = videos.get(String(p[0]));
        if (!v || v.userId !== p[1]) return { rows: [], rowCount: 0 };
        videos.delete(String(p[0]));
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('FROM "QMediaVideo"')) {
        let rows = [...videos.values()].map(copy);
        if (s.includes('"id" = $1')) rows = rows.filter((r) => r.id === p[0]);
        else if (s.includes('"userId" = $1')) rows = rows.filter((r) => r.userId === p[0]);
        else if (s.includes('"isPublic" = TRUE')) rows = rows.filter((r) => r.isPublic === true);
        return { rows, rowCount: rows.length };
      }
      if (s.includes('DELETE FROM "QMediaLike"')) {
        const k = `${p[0]}|${p[1]}|${p[2]}`;
        const had = likes.delete(k);
        return { rows: [], rowCount: had ? 1 : 0 };
      }
      if (s.includes('INSERT INTO "QMediaLike"')) {
        likes.add(`${p[0]}|${p[1]}|${p[2]}`);
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('FROM "QMediaLike"')) {
        const rows = [...likes]
          .filter((k) => k.split("|")[0] === p[0])
          .map((k) => ({ resourceId: k.split("|")[1], resourceType: k.split("|")[2] }));
        return { rows, rowCount: rows.length };
      }
      if (s.includes('INSERT INTO "QMediaPlaylist"')) {
        playlists.set(String(p[0]), {
          id: p[0], userId: p[1], name: p[2], description: p[3], isPublic: p[4],
          trackIds: JSON.parse(String(p[5])), collaborators: JSON.parse(String(p[6])),
          createdAt: p[7], updatedAt: p[8],
        });
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('DELETE FROM "QMediaPlaylist"')) {
        const pl = playlists.get(String(p[0]));
        if (!pl || pl.userId !== p[1]) return { rows: [], rowCount: 0 };
        playlists.delete(String(p[0]));
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('FROM "QMediaPlaylist"')) {
        let rows = [...playlists.values()].map(copy);
        if (s.includes('"id" = $1')) rows = rows.filter((r) => r.id === p[0]);
        else if (s.includes('"userId" = $1')) rows = rows.filter((r) => r.userId === p[0]);
        else if (s.includes('"isPublic" = TRUE')) rows = rows.filter((r) => r.isPublic === true);
        return { rows, rowCount: rows.length };
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
        let rows = [...tracks.values()].map(copy);
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

  test("плейлист и права соавтора ложатся в базу", async () => {
    const before = playlists.size;
    const made = await request(app())
      .post("/x/me/playlists")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Вечерний", isPublic: true });
    expect(made.status, `плейлист не создан: ${JSON.stringify(made.body)}`).toBe(201);
    expect(playlists.size, "плейлист не доехал до базы").toBe(before + 1);
    const id = made.body.id as string;

    // Соавторы: колонки для них не существовало вовсе, хотя поле в типе было.
    const collab = await request(app())
      .post(`/x/me/playlists/${id}/collaborators`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ userId: "friend-1", canEdit: true });
    expect(collab.status).toBe(200);
    const stored = playlists.get(id) as { collaborators?: Array<{ userId: string }> };
    expect(stored.collaborators?.[0]?.userId, "право соавтора не сохранено").toBe("friend-1");

    // И соавтор действительно может править — права читаются из базы.
    const friend = jwt.sign({ sub: "friend-1" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });
    const add = await request(app())
      .post(`/x/me/playlists/${id}/tracks`)
      .set("Authorization", `Bearer ${friend}`)
      .send({ trackId: "t-1" });
    expect(add.status, "соавтор с правом правки получил отказ").toBe(200);
    // Код ответа сам по себе ничего не доказывает: проверяем, что трек ЛЁГ
    // в хранилище. Без этого «добавление не сохраняется» проходило молча.
    const afterAdd = playlists.get(id) as { trackIds?: string[] };
    expect(afterAdd.trackIds, "трек не доехал до плейлиста в базе").toContain("t-1");

    // А посторонний — нет.
    const stranger = jwt.sign({ sub: "nobody-2" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });
    const denied = await request(app())
      .post(`/x/me/playlists/${id}/tracks`)
      .set("Authorization", `Bearer ${stranger}`)
      .send({ trackId: "t-2" });
    expect(denied.status, "посторонний правит чужой плейлист").toBe(403);
  });

  test("видео ложится в базу, просмотр считается там же", async () => {
    const before = videos.size;
    const made = await request(app())
      .post("/x/me/videos")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Ролик", isPublic: true });
    expect(made.status, `видео не создано: ${JSON.stringify(made.body)}`).toBe(201);
    expect(videos.size, "видео не доехало до базы").toBe(before + 1);

    const id = made.body.id as string;
    const view = await request(app()).post(`/x/videos/${id}/view`);
    expect(view.status).toBe(200);
    expect(view.body.viewCount).toBe(1);
    expect(videos.get(id)?.viewCount, "счётчик вырос только на экране").toBe(1);
  });

  test("лайк ложится в базу и снимается там же", async () => {
    const before = likes.size;
    const on = await request(app())
      .post("/x/track/t-99/like")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(on.status).toBe(200);
    expect(on.body.liked).toBe(true);
    expect(likes.size, "лайк не доехал до базы").toBe(before + 1);

    const list = await request(app()).get("/x/me/likes").set("Authorization", `Bearer ${TOKEN}`);
    expect(list.body.items.some((l: { id: string }) => l.id === "t-99")).toBe(true);

    const off = await request(app())
      .post("/x/track/t-99/like")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(off.body.liked, "повторное нажатие не сняло лайк").toBe(false);
    expect(likes.size, "снятие лайка не дошло до базы").toBe(before);
  });
});
