import { describe, test, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import express from "express";

/**
 * Сводка событий считала только поля верхнего уровня. Канал раздачи (tt / ig)
 * и товар, по которому нажали «купить», приезжают в `meta` — и до 13.08.2026
 * не попадали в сводку вовсе. То есть метка `?c=tt` в шапке профиля
 * собиралась бы, а ответить «сработала ли раздача» было бы нечем: цифра
 * доезжает и её никто не видит.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-events-"));
const FILE = join(TMP, "events.jsonl");
process.env.EVENTS_FILE = FILE;
delete process.env.ADMIN_TOKEN; // сводка без токена, чтобы тест мерил агрегацию, а не защиту

// ВАЖНО: динамический импорт. Статический витест поднимает ВЫШЕ присваивания
// process.env, и модуль запоминает дефолтный путь к файлу событий — сводка
// читала бы чужой файл и молча отвечала «событий нет».
const { eventsRouter } = await import("../src/routes/events");

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

function write(events: Record<string, unknown>[]) {
  writeFileSync(FILE, events.map((e) => JSON.stringify({ ts: new Date().toISOString(), ...e })).join("\n") + "\n", "utf8");
}

beforeEach(() => writeFileSync(FILE, "", "utf8"));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("сводка событий показывает канал раздачи и товар", () => {
  test("посещения группируются по каналу", async () => {
    write([
      { type: "page_view", source: "go", meta: { channel: "tiktok" } },
      { type: "page_view", source: "go", meta: { channel: "tiktok" } },
      { type: "page_view", source: "go", meta: { channel: "instagram" } },
    ]);

    const r = await request(app()).get("/api/pricing/events/summary");

    expect(r.status).toBe(200);
    expect(r.body.byChannel).toEqual({ tiktok: 2, instagram: 1 });
  });

  test("клики «купить» группируются по товару", async () => {
    write([
      { type: "cta_click", source: "go", meta: { channel: "tiktok", product: "tmuyxw" } },
      { type: "cta_click", source: "go", meta: { channel: "tiktok", product: "ghvzq" } },
      { type: "cta_click", source: "go", meta: { channel: "tiktok", product: "tmuyxw" } },
    ]);

    const r = await request(app()).get("/api/pricing/events/summary");

    expect(r.body.byProduct).toEqual({ tmuyxw: 2, ghvzq: 1 });
  });

  test("события без канала не ломают сводку и не считаются", async () => {
    write([
      { type: "page_view", source: "pricing" },
      { type: "page_view", source: "go", meta: { channel: "tiktok" } },
      { type: "page_view", source: "go", meta: { channel: 42 } }, // мусор вместо строки
    ]);

    const r = await request(app()).get("/api/pricing/events/summary");

    expect(r.body.total).toBe(3);
    expect(r.body.byChannel).toEqual({ tiktok: 1 });
  });

  test("весь путь: событие принято ручкой → попало в сводку с каналом", async () => {
    // Отдельно от случаев выше: там файл писался руками, то есть проверялась
    // только агрегация. Здесь событие проходит настоящий приёмник, который
    // фильтрует meta — если бы он выбрасывал незнакомые ключи, канал не дожил
    // бы до сводки, а агрегация всё равно выглядела бы исправной.
    const a = app();
    const post = await request(a)
      .post("/api/pricing/events")
      .set("Content-Type", "application/json")
      .send({ type: "cta_click", source: "go", sid: "s1", meta: { channel: "tiktok", product: "tmuyxw" } });
    expect(post.status).toBe(204);

    const r = await request(a).get("/api/pricing/events/summary");

    expect(r.body.byChannel).toEqual({ tiktok: 1 });
    expect(r.body.byProduct).toEqual({ tmuyxw: 1 });
  });

  test("на пустом наборе поля есть и пустые, а не отсутствуют", async () => {
    const r = await request(app()).get("/api/pricing/events/summary");

    // Страница читает summary.byChannel — отсутствие поля уронило бы её,
    // а пустой объект честно означает «раздача пока никого не привела».
    expect(r.body.byChannel).toEqual({});
    expect(r.body.byProduct).toEqual({});
  });
});
