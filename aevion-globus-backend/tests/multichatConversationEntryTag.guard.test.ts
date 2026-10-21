// Диалог Мультичата помнит метку захода (?c= / probe-<окно>).
//
// Замер 21.10.2026: в прод-базе 34 диалога, наших ≥28, неопознанных ≤6 — гость
// без адреса почты не отличался от нашей пробы, потому что диалог не хранил,
// откуда пришёл человек. Сторож делает запрос к ручке и смотрит СТРОКУ БАЗЫ:
// и файловую ветку, и Postgres (параметры INSERT в entry_tag).

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const pgCalls: Array<{ sql: string; params: unknown[] }> = [];
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      pgCalls.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
  }),
}));

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-for-multichat-entrytag-0123456789";
let app: express.Express;
let dataDir: string;
let token: string;
const prev = { data: "", secret: "", db: "" } as Record<string, string | undefined>;

beforeEach(() => {
  prev.data = process.env.AEVION_DATA_DIR;
  prev.secret = process.env.AUTH_JWT_SECRET;
  prev.db = process.env.DATABASE_URL;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-tag-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  pgCalls.length = 0;
  token = jwt.sign({ sub: "user_tag_test", email: "tag@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });
  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);
});

afterEach(() => {
  for (const [k, v] of [["AEVION_DATA_DIR", prev.data], ["AUTH_JWT_SECRET", prev.secret], ["DATABASE_URL", prev.db]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

function storedConversations(): Array<Record<string, unknown>> {
  const found: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = path.join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === "multichat-conversations.json") found.push(p);
    }
  };
  walk(dataDir);
  expect(found.length).toBe(1);
  return JSON.parse(readFileSync(found[0], "utf8")).items;
}

const create = (body: unknown) =>
  request(app).post("/api/multichat/conversations").set("Authorization", `Bearer ${token}`).send(body as object);

describe("Мультичат: метка захода в строке диалога", () => {
  test("файловая ветка: probe-метка и метка канала доезжают до записи", async () => {
    expect((await create({ title: "q1", entryTag: "probe-prodakt" })).status).toBe(201);
    expect((await create({ title: "q2", entryTag: "YT-Chess-Level" })).status).toBe(201);
    const items = storedConversations();
    expect(items.map((i) => i.entryTag)).toEqual(["probe-prodakt", "yt-chess-level"]);
  });

  test("чужой ввод и отсутствие метки — честный null, не выдуманная строка", async () => {
    await create({ title: "a" });
    await create({ title: "b", entryTag: "<script>" });
    await create({ title: "c", entryTag: "x".repeat(61) });
    await create({ title: "d", entryTag: 42 });
    expect(storedConversations().map((i) => i.entryTag)).toEqual([null, null, null, null]);
  });

  test("Postgres: INSERT кладёт метку в entry_tag, схема добавляет столбец", async () => {
    process.env.DATABASE_URL = "postgres://mock/db";
    const r = await create({ title: "pg", entryTag: "probe-prodakt" });
    expect(r.status).toBe(201);
    expect(r.body.entryTag).toBe("probe-prodakt");
    const schema = pgCalls.find((c) => /CREATE TABLE IF NOT EXISTS multichat_conversations/.test(c.sql));
    expect(schema?.sql).toMatch(/ADD COLUMN IF NOT EXISTS entry_tag TEXT/);
    const ins = pgCalls.find((c) => /INSERT INTO multichat_conversations/.test(c.sql));
    expect(ins, `запросов к пулу: ${pgCalls.length}`).toBeTruthy();
    const cols = ins!.sql.match(/\(([^)]*)\)\s*VALUES/)![1].split(",").map((s) => s.trim());
    expect(ins!.params[cols.indexOf("entry_tag")]).toBe("probe-prodakt");
  });
});
