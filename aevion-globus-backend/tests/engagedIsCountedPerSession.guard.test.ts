import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 ПРИЗНАК ЧЕЛОВЕКА: доля «похоже на чтение» среди живых заходов.
 *
 * Повод 07.10.2026, слово оркестратора. Замер того же утра: за трое суток 515
 * живых просмотров и ОДНО нажатие на всю платформу. Прежде чем чинить первый
 * экран двух страниц, надо знать, люди ли эти просмотры: внешний обходчик
 * ссылок YouTube исполняет JS и в наших числах выглядел живым человеком.
 *
 * Чего признак НЕ обещает: человека. Обходчик, подождавший десять секунд,
 * пройдёт. Надёжно обратное: нулевая доля engaged среди живых значит, что
 * страницу никто не читает, и чинить её вид рано.
 *
 * ⚠️ Импорты модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ (сторож, нарушивший это, был зелёным на чужом журнале).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-engaged-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ...о })).join("\n") + "\n");
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

async function воронка() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return request(app).get("/api/pricing/events/funnel?days=1");
}

describe("внимание считается по сессиям и приходит в теле", () => {
  it("🔴 сессия с engaged видна в итоге, по каналу и по странице входа", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "читал", path: "/en/devhub?c=ph", meta: { channel: "product-hunt" } },
      { type: "engaged", ts: сейчас(), sid: "читал", path: "/en/devhub", meta: { channel: "product-hunt", причина: "время" } },
      // Второй заход без признака: он смотрел, но читать не стал.
      { type: "page_view", ts: сейчас(), sid: "ушёл", path: "/en/devhub?c=ph", meta: { channel: "product-hunt" } },
    ]);
    const r = await воронка();
    expect(r.status).toBe(200);
    expect(r.body.totalBySession.engaged, "признак посчитан, но не отдан").toBe(1);
    expect(r.body.totalBySession.engagedOurs).toBe(0);
    expect(r.body.byChannel["product-hunt"].engaged).toBe(1);
    expect(r.body.byEntryPage["product-hunt|/en/devhub"].внимание).toBe(1);
    // Доля, за которой и заводили: 1 из 2 живых заходов похож на чтение.
    expect(r.body.byEntryPage["product-hunt|/en/devhub"].сессий).toBe(2);
  });

  it("единица — СЕССИЯ: два события внимания одного человека это один", async () => {
    // Фронт шлёт раз за сессию, но журнал может получить повтор (две вкладки,
    // перезагрузка без хранилища). Сервер не имеет права считать это двумя.
    журнал([
      { type: "page_view", ts: сейчас(), sid: "один", path: "/?c=yt", meta: { channel: "youtube" } },
      { type: "engaged", ts: сейчас(), sid: "один", path: "/", meta: { channel: "youtube" } },
      { type: "engaged", ts: сейчас(), sid: "один", path: "/", meta: { channel: "youtube" } },
    ]);
    const r = await воронка();
    expect(r.body.totalBySession.engaged).toBe(1);
    expect(r.body.byChannel.youtube.engaged).toBe(1);
  });

  it("наши пробы отделены: иначе свои прогоны станут «читающими людьми»", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "наш", path: "/?c=probe-okno", meta: { channel: "probe-okno" } },
      { type: "engaged", ts: сейчас(), sid: "наш", path: "/", meta: { channel: "probe-okno" } },
    ]);
    const r = await воронка();
    expect(r.body.totalBySession.engaged).toBe(1);
    expect(r.body.totalBySession.engagedOurs, "наша проба не помечена нашей").toBe(1);
    expect(
      r.body.totalBySession.engaged - r.body.totalBySession.engagedOurs,
      "наша проба ушла в живое внимание",
    ).toBe(0);
  });

  it("🔴 КОНТРОЛЬ: без события внимания доля НОЛЬ при живых визитах", async () => {
    /*
     * Это и есть ожидаемая сейчас картина, если 515 просмотров — машины.
     * Важно, чтобы ноль был честным: визиты при этом считаются, то есть
     * прибор работает, а не молчит.
     */
    журнал([
      { type: "page_view", ts: сейчас(), sid: "a", path: "/?c=yt", meta: { channel: "youtube" } },
      { type: "page_view", ts: сейчас(), sid: "b", path: "/?c=yt", meta: { channel: "youtube" } },
      { type: "page_view", ts: сейчас(), sid: "c", path: "/?c=yt", meta: { channel: "youtube" } },
    ]);
    const r = await воронка();
    expect(r.body.totalBySession.visits).toBe(3);
    expect(r.body.totalBySession.engaged).toBe(0);
    expect(r.body.byChannel.youtube.engaged).toBe(0);
  });

  it("сводка дня несёт строку «внимание» — она идёт в отчёт", async () => {
    журнал([
      { type: "page_view", ts: сейчас(), sid: "ч", path: "/?c=ph", meta: { channel: "product-hunt" } },
      { type: "engaged", ts: сейчас(), sid: "ч", path: "/", meta: { channel: "product-hunt" } },
    ]);
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use("/api/pricing/events", eventsRouter);
    const день = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = await request(app).get(`/api/pricing/events/day?date=${день}`);
    expect(Object.keys(r.body), "строка посчитана, но не отдана").toContain("внимание");
    expect(r.body.внимание).toEqual({ всего: 1, наши: 0, живые: 1 });
  });

  it("про событие можно СПРОСИТЬ по типу — список для чтения производный", async () => {
    журнал([{ type: "engaged", ts: сейчас(), sid: "ч", path: "/" }]);
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use("/api/pricing/events", eventsRouter);
    const день = new Date().toISOString().slice(0, 10);
    const r = await request(app).get(`/api/pricing/events/by-type?day=${день}&types=engaged`);
    expect(r.status, "ручка не знает типа, который сама принимает").toBe(200);
    expect(r.body.поТипу.engaged.всего).toBe(1);
  });

  it("КОНТРОЛЬ: пишущая ручка принимает это имя", async () => {
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use(express.json());
    app.use("/api/pricing/events", eventsRouter);
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "engaged", sid: "новый", path: "/" })
      .expect(204);
  });
});
