import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { деньАлматыНазад } from "./helpers/суткиАлматы";

/*
 * 🔴 «С КАКОГО РОЛИКА ДОШЛИ ДО СБОРКИ» — ПЕРЕСЕЧЕНИЕ, А НЕ ДВЕ СУММЫ.
 *
 * Замер 12.10.2026 по живой воронке: byPost — 106 ключей, byFeature — 6, но
 * РАЗДЕЛЬНО. Из «сколько пришло с ролика» и «сколько собрало приложение»
 * пересечение не выводится: это разные множества сессий. То есть вопрос, ради
 * которого размечались ролики, оставался без ответа.
 *
 * Сторож делает настоящий GET к ручке и читает ТЕЛО ответа.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-postfeature-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сегодня = () => `${деньАлматыНазад(0)}T07:00:00.000Z`;

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ts: сегодня(), ...о })).join("\n") + "\n");
}

/** Заход с метки ролика: канал и пост приезжают в meta ПЕРВОГО события. */
function заход(sid: string, канал: string, пост: string, path = "/devhub") {
  return { type: "page_view", sid, path, meta: { channel: канал, post: пост } };
}
function шаг(sid: string, feature: string, source = "devhub") {
  return { type: "feature_use", sid, source, path: "/devhub", meta: { feature } };
}

beforeAll(async () => { await import("../src/routes/events"); }, 120_000);
beforeEach(() => журнал([]));
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

async function разрез() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  const r = await request(app).get("/api/pricing/events/funnel?days=7");
  expect(r.status).toBe(200);
  return r.body as {
    byPostFeature?: Record<string, { сессий: number; сессийНаших: number }>;
    byPostFeatureВсего?: number;
    byPostFeatureNote?: string;
  };
}

describe("пост × шаг внутри модуля", () => {
  it("🔴 видно, с какого ролика дошли до сборки, а с какого только зашли", async () => {
    журнал([
      // Ролик A: один зашёл и собрал, другой только зашёл.
      заход("a1", "youtube", "chess-level"), шаг("a1", "build_from_idea"),
      заход("a2", "youtube", "chess-level"),
      // Ролик B: зашли двое, собрал никто.
      заход("b1", "youtube", "devhub-77"),
      заход("b2", "youtube", "devhub-77"),
    ]);
    const f = await разрез();
    expect(f.byPostFeature, "пересечения нет в ТЕЛЕ ответа").toBeTruthy();
    expect(f.byPostFeature!["youtube/chess-level|build_from_idea"]?.сессий).toBe(1);
    // Ровно то, что нельзя было узнать раньше: у ролика B сборок НЕТ вовсе.
    expect(f.byPostFeature!["youtube/devhub-77|build_from_idea"], "у ролика без сборок появилась строка").toBeUndefined();
    expect(f.byPostFeatureВсего, "знаменатель пар не назван").toBe(1);
  });

  it("считается по СЕССИЯМ: три шага одной сессии — одна сессия", async () => {
    журнал([
      заход("c1", "youtube", "chess-level"),
      шаг("c1", "generation"), шаг("c1", "generation"), шаг("c1", "generation"),
    ]);
    const f = await разрез();
    expect(f.byPostFeature!["youtube/chess-level|generation"].сессий).toBe(1);
  });

  it("🔴 сессия БЕЗ метки поста в пересечение не попадает вовсе", async () => {
    // «unknown» здесь был бы вреден: прямые заходы слились бы в один «ролик»
    // и выглядели бы лучшим источником сборок.
    журнал([
      { type: "page_view", sid: "d1", path: "/devhub", ts: сегодня(), ua: UA },
      шаг("d1", "build_from_idea"),
    ]);
    const f = await разрез();
    expect(Object.keys(f.byPostFeature!).length).toBe(0);
    expect(f.byPostFeatureВсего).toBe(0);
  });

  it("наши пробы отделены от людей", async () => {
    журнал([
      заход("чел", "youtube", "chess-level"), шаг("чел", "build_from_idea"),
      { type: "page_view", sid: "наш", path: "/devhub?c=probe-user-99", ts: сегодня(), ua: UA, meta: { channel: "youtube", post: "chess-level" } },
      шаг("наш", "build_from_idea"),
    ]);
    const f = await разрез();
    const п = f.byPostFeature!["youtube/chess-level|build_from_idea"];
    expect(п.сессий).toBe(2);
    expect(п.сессийНаших, "наша проба засчитана живым человеком").toBe(1);
  });

  it("вывод обрезан, и обрезка названа в самом ответе", async () => {
    // Молчаливая обрезка читается как «больше ничего нет» — это и есть ложь
    // числом. Проверяем, что знаменатель и пояснение едут вместе с данными.
    const события: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 60; i++) {
      события.push(заход("s" + i, "youtube", "rolik-" + i), шаг("s" + i, "build_from_idea"));
    }
    журнал(события);
    const f = await разрез();
    expect(Object.keys(f.byPostFeature!).length, "обрезка не применилась").toBe(50);
    expect(f.byPostFeatureВсего, "знаменатель не назван или неверен").toBe(60);
    expect(String(f.byPostFeatureNote), "обрезка не объяснена читателю").toContain("50");
  });
});
