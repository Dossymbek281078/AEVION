import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 СТОРОЖ НА ВЕСЬ ПУТЬ: POST → журнал → GET.
 *
 * Повод 06.10.2026, и он стоит прочтения, потому что мы на этом уже сидели.
 * Фронт отправлял `webdriver: true`, разрез по этому признаку отсеивал
 * автоматику, сторож `automationIsExcludedByWebdriver` был зелёный — а на проде
 * отсев не работал ни дня: обработчик POST поле НЕ ЧИТАЛ, оно молча выпадало
 * при записи. Зелёный сторож писал события в журнал НАПРЯМУЮ и потому проверял
 * только вторую половину пути.
 *
 * Отсюда правило этого файла: поле, которое шлёт клиент, проверяется запросом
 * к ручке записи и чтением ТЕЛА ручки чтения. Между ними ничего не
 * подкладывается руками.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-ref-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

beforeEach(() => {
  writeFileSync(файл, "");
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

describe("источник перехода доживает от клиента до разреза", () => {
  it("🔴 refHost записывается обработчиком POST, а не теряется молча", async () => {
    const app = await приложение();
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "page_view", sid: "гость", path: "/", refHost: "news.ycombinator.com" })
      .expect(204);

    const записано = JSON.parse(readFileSync(файл, "utf8").trim());
    expect(записано.refHost, "поле выпало при записи").toBe("news.ycombinator.com");
  });

  it("🔴 webdriver тоже записывается — отсев автоматики без этого мёртв", async () => {
    const app = await приложение();
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "page_view", sid: "робот", path: "/", webdriver: true })
      .expect(204);

    const записано = JSON.parse(readFileSync(файл, "utf8").trim());
    expect(записано.webdriver, "признак автоматики выпал при записи").toBe(true);
  });

  it("хост приводится к нижнему регистру и обрезается по длине", async () => {
    const app = await приложение();
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "page_view", sid: "s", path: "/", refHost: "  T.CO  " })
      .expect(204);
    expect(JSON.parse(readFileSync(файл, "utf8").trim()).refHost).toBe("t.co");
  });

  it("чужое значение не того типа не ломает запись и не попадает в журнал", async () => {
    const app = await приложение();
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "page_view", sid: "s", path: "/", refHost: { зло: 1 } })
      .expect(204);
    expect(JSON.parse(readFileSync(файл, "utf8").trim()).refHost).toBeUndefined();
  });

  it("🔴 разрез по источникам приходит в ТЕЛЕ ответа воронки", async () => {
    const app = await приложение();
    const события = [
      { type: "page_view", sid: "a", path: "/", refHost: "t.co" },
      { type: "page_view", sid: "a", path: "/pricing", refHost: "t.co" },
      { type: "page_view", sid: "b", path: "/", refHost: "t.co" },
      { type: "page_view", sid: "c", path: "/" },
      { type: "page_view", sid: "d", path: "/", refHost: "aevion.app" },
    ];
    for (const е of события) {
      await request(app).post("/api/pricing/events").send(е).expect(204);
    }

    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    expect(Object.keys(r.body), "разрез посчитан, но не отдан").toContain("byReferrerHost");

    const раз = r.body.byReferrerHost;
    // Единица — сессия: две сессии с t.co, при трёх событиях.
    expect(раз["t.co"].visits).toBe(2);
    expect(раз["t.co"].pricing).toBe(1);
    // Отсутствие источника и внутренний переход — РАЗНЫЕ ответы, не «direct».
    expect(раз["(не назван)"].visits).toBe(1);
    expect(раз["(внутри сайта)"].visits).toBe(1);
  });

  it("источником сессии считается ПЕРВОЕ её событие, а не последнее", async () => {
    const app = await приложение();
    // Человек пришёл с чужой площадки, потом ходил по сайту: внутренние
    // переходы не должны переписывать происхождение — иначе весь трафик
    // окажется «внутри сайта», и разрез снова не ответит ни на что.
    for (const е of [
      { type: "page_view", sid: "х", path: "/", refHost: "reddit.com" },
      { type: "page_view", sid: "х", path: "/pricing", refHost: "aevion.app" },
    ]) {
      await request(app).post("/api/pricing/events").send(е).expect(204);
    }
    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byReferrerHost["reddit.com"].visits).toBe(1);
    expect(r.body.byReferrerHost["reddit.com"].pricing).toBe(1);
    expect(r.body.byReferrerHost["(внутри сайта)"]).toBeUndefined();
  });
});
