import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { деньАлматыНазад } from "./helpers/суткиАлматы";

/*
 * 🔴 ШАГИ ВНУТРИ МОДУЛЯ ВИДНО ОТДЕЛЬНО.
 *
 * Замер 12.10.2026 (приёмка user-99, прод ab897e2dd35c): DevHub давно шлёт три
 * шага пути покупателя — build_from_idea (нажал «Построить»), generation (файлы
 * пришли), deploy_pages (выложил на свой адрес) — событиями feature_use.
 * Воронка их принимала и складывала в общие ступени «внимание» и «попробовали»,
 * где они смешаны с шахматами. В теле /funnel слов feature, build_from_idea,
 * generation, deploy_pages было РОВНО НОЛЬ при 145 КБ ответа. На вопрос
 * «сколько человек довели приложение до адреса» ответить было нечем.
 *
 * Сторож делает настоящий GET к ручке и проверяет ТЕЛО ответа.
 * ⚠️ Импорт модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-byfeature-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

/** Метка времени «сегодня, середина дня по Алматы». */
function сегодня(): string {
  return `${деньАлматыНазад(0)}T07:00:00.000Z`;
}

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ts: сегодня(), ...о })).join("\n") + "\n");
}

/** Шаг внутри модуля — ровно в том виде, в каком его шлёт фронт DevHub. */
function шаг(sid: string, feature: string, source = "devhub", path = "/devhub") {
  return { type: "feature_use", sid, source, path, meta: { feature } };
}

beforeAll(async () => {
  await import("../src/routes/events");
}, 120_000);

beforeEach(() => {
  журнал([]);
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

async function разрез(app: express.Express) {
  const r = await request(app).get("/api/pricing/events/funnel?days=7");
  expect(r.status).toBe(200);
  expect(r.body.byFeature, "byFeature обязан лежать в ТЕЛЕ ответа, а не только считаться").toBeTruthy();
  return r.body.byFeature as Record<string, { сессий: number; сессийНаших: number }>;
}

describe("воронка видит шаги внутри DevHub", () => {
  it("🔴 три шага приходят тремя строками, а не одной кучей", async () => {
    журнал([
      шаг("с1", "build_from_idea"),
      шаг("с1", "generation"),
      шаг("с2", "build_from_idea"),
      шаг("с3", "deploy_pages"),
    ]);
    const f = await разрез(await приложение());
    expect(f["devhub|build_from_idea"]?.сессий).toBe(2);
    expect(f["devhub|generation"]?.сессий).toBe(1);
    expect(f["devhub|deploy_pages"]?.сессий).toBe(1);
    // знаменатель: названы все три шага, а не «какие-то»
    expect(Object.keys(f).filter((k) => k.startsWith("devhub|")).length).toBe(3);
  });

  it("считается по СЕССИЯМ: три события одной сессии — одна сессия", async () => {
    журнал([шаг("с1", "generation"), шаг("с1", "generation"), шаг("с1", "generation")]);
    const f = await разрез(await приложение());
    expect(f["devhub|generation"].сессий).toBe(1);
  });

  it("наши пробы отделены от людей", async () => {
    /*
     * Сессия признаётся нашей по page_view с меткой — как в жизни: заход
     * всегда начинается просмотром страницы, и метка приезжает в нём.
     * Проверено на себе 12.10.2026: сторож, где метка стояла только на
     * feature_use, давал «наших 0» — и это НЕ дефект разреза, а дефект
     * сторожа. Отсюда же правило §0-НАШИ-ЗАХОДЫ: метить С ПЕРВОГО захода,
     * иначе наша проба сосчитается живым человеком.
     */
    журнал([
      { type: "page_view", sid: "чел", path: "/devhub", ts: сегодня(), ua: UA },
      шаг("чел", "generation"),
      { type: "page_view", sid: "наш", path: "/devhub?c=probe-user-99", ts: сегодня(), ua: UA },
      шаг("наш", "generation", "devhub", "/devhub?c=probe-user-99"),
    ]);
    const f = await разрез(await приложение());
    expect(f["devhub|generation"].сессий).toBe(2);
    expect(f["devhub|generation"].сессийНаших).toBe(1);
  });

  it("источники не смешиваются: тот же шаг другого модуля — своя строка", async () => {
    журнал([шаг("с1", "generation"), шаг("с2", "generation", "cyberchess", "/cyberchess")]);
    const f = await разрез(await приложение());
    expect(f["devhub|generation"].сессий).toBe(1);
    expect(f["cyberchess|generation"].сессий).toBe(1);
  });

  it("событие без названия шага в разрез не попадает и пустого ключа не создаёт", async () => {
    журнал([
      { type: "feature_use", sid: "с1", source: "devhub", path: "/devhub", ts: сегодня(), ua: UA },
      шаг("с2", "   "),
    ]);
    const f = await разрез(await приложение());
    expect(Object.keys(f).filter((k) => k.endsWith("|")).length).toBe(0);
    expect(Object.keys(f).length).toBe(0);
  });

  it("контроль: событие ДРУГОГО типа сюда не попадает", async () => {
    журнал([
      { type: "cta_click", sid: "с1", path: "/devhub", source: "devhub", ts: сегодня(), ua: UA, meta: { feature: "generation" } },
      шаг("с2", "generation"),
    ]);
    const f = await разрез(await приложение());
    expect(f["devhub|generation"].сессий).toBe(1);
  });
});
