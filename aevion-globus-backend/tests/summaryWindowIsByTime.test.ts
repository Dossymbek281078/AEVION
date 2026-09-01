/**
 * Окно сводки берётся по ВРЕМЕНИ, а не по числу строк.
 *
 * Было наоборот: брались последние `limit` строк, и только потом применялся
 * фильтр по времени. При журнале длиннее предела ответ на вопрос «что было за
 * 30 дней» молча превращался в «что было за последние N событий» — и выглядел
 * как полный. Замер 01.09.2026: в журнале прода 4476 событий при пределе 5000,
 * то есть 89 % запаса израсходовано. Упёрлось бы при первом всплеске трафика,
 * ровно когда по этим числам решают о бюджете рекламы.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import express from "express";

const TMP = mkdtempSync(join(tmpdir(), "aevion-window-"));
const FILE = join(TMP, "events.jsonl");
process.env.EVENTS_FILE = FILE;
delete process.env.ADMIN_TOKEN;

const { eventsRouter } = await import("../src/routes/events");

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

/** N событий подряд, свежие в конце — как в настоящем журнале. */
function журнал(n: number, часНазад: (i: number) => number) {
  const строки = [];
  for (let i = 0; i < n; i += 1) {
    строки.push(
      JSON.stringify({
        ts: new Date(Date.now() - часНазад(i) * 3600_000).toISOString(),
        type: "page_view",
        source: "pricing",
      }),
    );
  }
  writeFileSync(FILE, строки.join("\n") + "\n", "utf8");
}

describe("окно сводки по времени", () => {
  beforeEach(() => writeFileSync(FILE, "", "utf8"));

  it("длинный журнал не съедает окно: считаются ВСЕ события за период", async () => {
    // 300 событий, все за последние сутки. Предохранитель ставим меньше — 150.
    // Прежняя редакция вернула бы 150 (последние строки), новая — все 300.
    журнал(300, () => 0.5);
    const r = await request(app()).get("/api/pricing/events/summary?hours=24&limit=150");
    expect(r.status).toBe(200);
    expect(r.body.truncated, "предохранитель сработал внутри окна — так и скажи").toBe(true);
    expect(r.body.consideredEvents).toBe(150);
    expect(r.body.totalEvents).toBe(300);
  });

  it("события старше окна не считаются, даже если строк мало", async () => {
    журнал(10, (i) => (i < 5 ? 100 : 1)); // пять старых, пять свежих
    const r = await request(app()).get("/api/pricing/events/summary?hours=24&limit=5000");
    expect(r.body.total).toBe(5);
    expect(r.body.truncated, "предохранитель не срабатывал — обрезки нет").toBe(false);
  });

  it("длинный ХВОСТ старых событий больше не выглядит обрезкой", async () => {
    // Различающий случай, и его подсказала мутация: в прежней редакции признак
    // обрезки считался как «строк в файле больше предела», поэтому журнал с
    // тысячей старых событий и десятком свежих кричал «обрезано» при полностью
    // покрытом окне. Ложная тревога на панели, по которой решают о бюджете,
    // ничем не лучше молчания: к ней привыкают и перестают читать.
    журнал(200, (i) => (i < 190 ? 500 : 1)); // 190 старых, 10 свежих
    const r = await request(app()).get("/api/pricing/events/summary?hours=24&limit=100");
    expect(r.body.total, "внутри окна ровно десять").toBe(10);
    expect(r.body.truncated, "окно покрыто целиком — обрезки нет").toBe(false);
    expect(r.body.consideredEvents).toBe(10);
    expect(r.body.totalEvents).toBe(200);
  });

  it("знаменатель на месте: сколько учтено из скольких", async () => {
    журнал(20, () => 1);
    const r = await request(app()).get("/api/pricing/events/summary?hours=24&limit=5000");
    expect(r.body.consideredEvents).toBe(20);
    expect(r.body.totalEvents).toBe(20);
  });

  it("битая строка не обрезает ответ на себе", async () => {
    // Одна порча посреди журнала не должна выглядеть как граница окна.
    const свежее = JSON.stringify({ ts: new Date().toISOString(), type: "page_view" });
    writeFileSync(FILE, [свежее, "{битая", свежее].join("\n") + "\n", "utf8");
    const r = await request(app()).get("/api/pricing/events/summary?hours=24&limit=5000");
    expect(r.body.total).toBe(2);
  });
});
