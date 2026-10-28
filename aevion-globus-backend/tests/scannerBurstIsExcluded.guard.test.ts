import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 Пачка сканера ссылок с разными строками браузера отсеивается.
 *
 * Замер 28.10.2026 (окно Наука): через минуту после правки описаний 27 роликов
 * пришли 63 сессии за 42 с по меткам yt-old-2810-*, Chrome 144–156 вразнобой.
 * Прежний признак обходчика группирует по ОДНОЙ строке браузера и их не видел:
 * сутки показали «живых визитов 47». Фикстура — настоящие 305 событий с прода
 * с 16:30 по Алматы, поле ip вырезано (оно всё равно адрес прокси сайта).
 *
 * Контроли: сессия с шагами человека (решила задачу) не попадает в пачку, как
 * и сессии вне пачки; одиночный посетитель с меткой — тоже.
 */
process.env.EVENTS_FILE = join(mkdtempSync(join(tmpdir(), "aevion-burst-")), "events.jsonl");

const ФИКСТУРА = readFileSync(join(__dirname, "fixtures", "events-2810-scanner-burst.jsonl"), "utf8");
type Событие = { sid?: string; type: string; ts: string; path?: string; ua?: string };
const события: Событие[] = ФИКСТУРА.split("\n").filter(Boolean).map((l) => JSON.parse(l));

let обходчики: (c: string) => { сессии: Set<string> };
beforeAll(async () => {
  ({ обходчики } = await import("../src/routes/events"));
}, 120_000);

const сессииПачки = new Set(
  события
    .filter((e) => e.ts < "2026-10-28T12:13:00Z" && /c=yt-old-2810-/.test(e.path ?? ""))
    .map((e) => e.sid!),
);

describe("пачка сканера ссылок (28.10.2026)", () => {
  it("в фикстуре та самая пачка: ≥60 сессий, строк браузера больше одной", () => {
    expect(сессииПачки.size).toBeGreaterThanOrEqual(60);
    const строки = new Set(
      события.filter((e) => сессииПачки.has(e.sid!)).map((e) => e.ua),
    );
    expect(строки.size).toBeGreaterThan(1);
  });

  it("все сессии пачки помечены как обходчик", () => {
    const { сессии } = обходчики(ФИКСТУРА);
    const пропущены = [...сессииПачки].filter((s) => !сессии.has(s));
    expect(пропущены).toEqual([]);
  });

  it("сессия, решавшая задачи (17:25–17:28), не помечена", () => {
    const сШагом = new Set(
      события.filter((e) => e.type === "puzzle_solved" || e.type === "game_progress").map((e) => e.sid!),
    );
    expect(сШагом.size).toBeGreaterThan(0);
    const { сессии } = обходчики(ФИКСТУРА);
    expect([...сШагом].filter((s) => сессии.has(s))).toEqual([]);
  });

  it("вне пачки ни одна сессия не помечена новым проходом", () => {
    const { сессии } = обходчики(ФИКСТУРА);
    const вне = [...сессии].filter((s) => !сессииПачки.has(s));
    expect(вне).toEqual([]);
  });

  it("девять сессий по девяти меткам и три прямых захода за минуту — ещё не пачка", () => {
    const t0 = Date.parse("2026-10-28T10:00:00Z");
    // Прямые заходы без метки в пачку не считаются: метка — то, что раздал сканеру ролик.
    const журнал = Array.from({ length: 12 }, (_, i) =>
      JSON.stringify({
        sid: `s_${i}`,
        type: "page_view",
        ts: new Date(t0 + i * 4000).toISOString(),
        path: i < 9 ? `/cyberchess?c=yt-x-${i}` : "/cyberchess",
        ua: `Mozilla/5.0 Chrome/${140 + i}.0.0.0`,
      }),
    ).join("\n");
    expect(обходчики(журнал).сессии.size).toBe(0);
  });

  it("внутри пачки не помечены решивший задачу и ушедший на вторую страницу", () => {
    const t0 = Date.parse("2026-10-28T10:00:00Z");
    const строки: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const база = { sid: `s_${i}`, path: `/cyberchess?c=yt-x-${i}`, ua: `Mozilla/5.0 Chrome/${140 + i}.0.0.0` };
      строки.push(JSON.stringify({ ...база, type: "page_view", ts: new Date(t0 + i * 4000).toISOString() }));
      if (i === 0) {
        строки.push(JSON.stringify({ ...база, type: "puzzle_solved", ts: new Date(t0 + 50_000).toISOString() }));
      }
      if (i === 1) {
        строки.push(JSON.stringify({ ...база, type: "page_view", path: "/pricing", ts: new Date(t0 + 50_000).toISOString() }));
      }
    }
    const { сессии } = обходчики(строки.join("\n"));
    expect(сессии.has("s_0")).toBe(false);
    expect(сессии.has("s_1")).toBe(false);
    expect(сессии.size).toBe(10);
  });

  it("десять сессий по одной метке за минуту — не пачка (вирусный ролик)", () => {
    const t0 = Date.parse("2026-10-28T10:00:00Z");
    const журнал = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({
        sid: `s_${i}`,
        type: "page_view",
        ts: new Date(t0 + i * 5000).toISOString(),
        path: `/cyberchess?c=yt-hit`,
        ua: `Mozilla/5.0 Chrome/${140 + i}.0.0.0`,
      }),
    ).join("\n");
    expect(обходчики(журнал).сессии.size).toBe(0);
  });
});
