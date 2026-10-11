import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 ТРИ ШАГА ВНУТРИ ЗАДАЧИ ЧИТАЮТСЯ ПУБЛИЧНО.
 *
 * Повод — замер окна 16 живым заходом на прод 12.10.2026 (перехват тел событий
 * из страницы, а не чтение кода):
 *
 *   открыл задачу по ссылке → page_view, feature_use
 *   НЕВЕРНЫЙ ход            → game_progress, waitlist_offer_shown, engaged
 *   подсказка (нажата)      → НИ ОДНОГО события
 *   верный ход              → НИ ОДНОГО события
 *   довёл до мата           → НИ ОДНОГО события
 *
 * То есть «ткнул не туда и ушёл» был неотличим от «начал решать»: оба дают один
 * `game_progress` на первом рубеже. Единственный живой человек за 11.10
 * (`youtube/komm-mat3-075iw`: порог 1, задача 1, показ 1, адрес 0) мог быть
 * любым из двух, и правка продукта зависит от того, каким именно.
 *
 * Отправители заведены окном 16 и УЖЕ принимаются пишущей ручкой. Без ступеней
 * здесь события копились бы и не читались — тот самый класс «посчитал и не
 * отдал», замеченный до выкатки, а не после.
 *
 * ⚠️ Смысл у этих трёх ОБРАТНЫЙ соседям: их рост не улучшает воронку, а
 * показывает, где она рвётся. Поэтому проверяется и подпись в ответе: «ошибок 7»
 * без неё прочтут как «семь человек решают», а это семь, которым не удалось.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-inside-puzzle-"));
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

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

/** Заход по ссылке ролика: канал и пост читаются ИЗ meta, не из адреса. */
function вход(sid: string, наш = false) {
  return {
    type: "page_view",
    ts: сейчас(),
    sid,
    path: наш ? "/cyberchess?c=yt&probe=okno" : "/cyberchess?c=yt",
    meta: { channel: "youtube", post: "komm-mat3" },
  };
}

function внутри(sid: string, тип: string, meta: Record<string, unknown> = {}) {
  return {
    type: тип,
    ts: сейчас(),
    sid,
    path: "/cyberchess",
    meta: { channel: "youtube", post: "komm-mat3", ...meta },
  };
}

describe("шаги внутри задачи читаются по постам, каналам и часам", () => {
  it("🔴 ошибка, подсказка и уход видны в byPost, и наши отделены", async () => {
    журнал([
      вход("живой"),
      внутри("живой", "puzzle_wrong_move", { попытка: 1 }),
      внутри("живой", "puzzle_hint", { ошибокДоЭтого: 1 }),
      внутри("живой", "puzzle_abandon", { ошибок: 1, полуходов: 2 }),
      вход("наш", true),
      внутри("наш", "puzzle_wrong_move", { попытка: 1 }),
      внутри("наш", "puzzle_hint"),
      внутри("наш", "puzzle_abandon"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    const п = r.body.byPost["youtube/komm-mat3"];
    expect(п, "строки поста нет — канал или пост читаются не из meta").toBeTruthy();
    for (const имя of ["wrongMove", "hintTaken", "abandonedPuzzle"]) {
      expect(п[имя], "ступень " + имя + " не доехала до byPost").toBe(2);
      expect(п[имя + "Ours"], "у ступени " + имя + " наши не отделены").toBe(1);
      expect(п[имя] - п[имя + "Ours"], "живых по " + имя + " вышло не столько").toBe(1);
    }
  });

  it("🔴 «ошибся и ушёл» ОТЛИЧИМ от «решил» — ради этого всё и сделано", async () => {
    /*
     * Два человека с одинаковым `progressed`. Прежде разрез показывал бы их
     * одинаково, и вывод «люди начали решать» был бы неверен наполовину.
     */
    журнал([
      вход("сдался"),
      внутри("сдался", "game_progress", { plies: 1 }),
      внутри("сдался", "puzzle_wrong_move", { попытка: 1 }),
      внутри("сдался", "puzzle_abandon", { ошибок: 1 }),
      вход("решил"),
      внутри("решил", "game_progress", { plies: 1 }),
      внутри("решил", "puzzle_solved"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/komm-mat3"];
    expect(п.progressed, "оба дошли до порога — это и была неразличимость").toBe(2);
    expect(п.puzzleSolved, "решивший не один").toBe(1);
    expect(п.wrongMove, "ошибка не названа").toBe(1);
    expect(п.abandonedPuzzle, "уход не назван").toBe(1);
    // Решивший НЕ считается ушедшим: «решил и ушёл» — успех, а не уход.
    expect(п.abandonedPuzzle, "решивший зачтён ушедшим").toBe(1);
  });

  it("🔴 те же три ступени есть в разрезе каналов", async () => {
    журнал([вход("живой"), внутри("живой", "puzzle_hint")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const к = r.body.byChannel.youtube;
    expect(к, "канала нет").toBeTruthy();
    expect(к.hintTaken).toBe(1);
    expect(к.hintTakenOurs).toBe(0);
    expect(typeof к.wrongMove).toBe("number");
    expect(typeof к.abandonedPuzzle).toBe("number");
  });

  it("🔴 и в разрезе часов — иначе час включения этих трёх назвать нечем", async () => {
    журнал([вход("живой"), внутри("живой", "puzzle_wrong_move", { попытка: 2 })]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const часы = r.body.byHour as Array<Record<string, number | string>>;
    const сОшибкой = часы.filter((ч) => Number(ч.wrongMove) > 0);
    expect(сОшибкой.length, "ступень не доехала до разреза часов").toBe(1);
    expect(сОшибкой[0].wrongMoveOurs).toBe(0);
  });

  it("🔴 ЧАС ТОЛЬКО С УХОДОМ не выпадает из разреза часов", async () => {
    /*
     * Носитель для ФИЛЬТРА часов, без которого он ничем не охраняется: в
     * проверке выше просмотр лежит в том же часе, поэтому час проходит фильтр
     * и без новых полей. А в жизни разрыв обычный: вошёл в 10:58, бросил задачу
     * в 11:03 — и час ухода не содержит ни одного page_view.
     */
    const ЧАС = 3600_000;
    const вошёл = new Date(Date.now() - 2 * ЧАС).toISOString();
    const бросил = new Date(Date.now() - 1 * ЧАС).toISOString();
    журнал([
      { ...вход("сквозь"), ts: вошёл },
      { ...внутри("сквозь", "puzzle_abandon", { ошибок: 2 }), ts: бросил },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const часы = r.body.byHour as Array<Record<string, number | string>>;
    const часУхода = часы.find((ч) => String(ч.hour) === бросил.slice(0, 13));
    expect(
      часУхода,
      "ЧАС С УХОДОМ БЕЗ ВИЗИТОВ ВЫПАЛ — фильтр часов не знает новых ступеней",
    ).toBeTruthy();
    expect(часУхода!.abandonedPuzzle).toBe(1);
    expect(часУхода!.visits, "в часе ухода визитов быть не должно").toBe(0);
  });

  it("🔴 пишущая ручка принимает все три: POST → журнал → GET", async () => {
    /*
     * Путь полный намеренно. Если бы имя не стояло в списке принимаемых, ручка
     * ответила бы 400, страница этого не увидела бы (track не читает ответ) и
     * шаг пропал бы молча. Отрицательный контроль выдуманным именем — рядом.
     */
    const app = await приложение();
    const вх = await request(app)
      .post("/api/pricing/events")
      .set("user-agent", UA)
      .send({ type: "page_view", sid: "через-ручку", path: "/cyberchess?c=yt", meta: { channel: "youtube", post: "komm-mat3" } });
    expect(вх.status, "просмотр не принят").toBe(204);

    for (const имя of ["puzzle_wrong_move", "puzzle_hint", "puzzle_abandon"]) {
      const о = await request(app)
        .post("/api/pricing/events")
        .set("user-agent", UA)
        .send({ type: имя, sid: "через-ручку", path: "/cyberchess", meta: { channel: "youtube", post: "komm-mat3" } });
      expect(о.status, "событие " + имя + " ручка не принимает").toBe(204);
    }
    const выдуманное = await request(app)
      .post("/api/pricing/events")
      .set("user-agent", UA)
      .send({ type: "puzzle_sdalsya_sovsem", sid: "через-ручку", path: "/cyberchess" });
    expect(выдуманное.status, "ручка принимает любое имя — список не работает").toBe(400);

    const r = await request(app).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/komm-mat3"];
    expect(п.wrongMove, "принятое событие не попало в разрез").toBe(1);
    expect(п.hintTaken).toBe(1);
    expect(п.abandonedPuzzle).toBe(1);
  });

  it("единица — СЕССИЯ: три ошибки одного человека это один", async () => {
    журнал([
      вход("упорный"),
      внутри("упорный", "puzzle_wrong_move", { попытка: 1 }),
      внутри("упорный", "puzzle_wrong_move", { попытка: 2 }),
      внутри("упорный", "puzzle_wrong_move", { попытка: 3 }),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byPost["youtube/komm-mat3"].wrongMove, "события сложились вместо сессии").toBe(1);
  });

  it("КОНТРОЛЬ: три шага НЕ подмешиваются в шаги вперёд", async () => {
    // Иначе «ошибся» выглядело бы прогрессом, и картина стала бы лучше правды.
    журнал([
      вход("ошибся"),
      внутри("ошибся", "puzzle_wrong_move", { попытка: 1 }),
      внутри("ошибся", "puzzle_hint"),
      внутри("ошибся", "puzzle_abandon"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/komm-mat3"];
    expect(п.progressed, "ошибка зачтена порогом").toBe(0);
    expect(п.puzzleSolved, "ошибка зачтена решением").toBe(0);
    expect(п.waitlistSubmitted).toBe(0);
    expect(п.wrongMove).toBe(1);
  });

  it("КОНТРОЛЬ: сессия без этих событий даёт по ним нули, а не отсутствие полей", async () => {
    // Отсутствующее поле читатель вычтет как undefined и получит NaN либо тихий
    // ноль там, где ответа нет.
    журнал([вход("просто-зашёл")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/komm-mat3"];
    for (const имя of ["wrongMove", "wrongMoveOurs", "hintTaken", "hintTakenOurs", "abandonedPuzzle", "abandonedPuzzleOurs"]) {
      expect(typeof п[имя], "нет поля " + имя).toBe("number");
      expect(п[имя]).toBe(0);
    }
  });

  it("🔴 оговорка о ПРОТИВОПОЛОЖНОМ смысле стоит в ответе", async () => {
    журнал([вход("живой"), внутри("живой", "puzzle_abandon")]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(String(r.body.insidePuzzleNote)).toMatch(/шаги НАЗАД/);
    expect(String(r.body.insidePuzzleNote)).toMatch(/где она рвётся/);
    expect(String(r.body.insidePuzzleNote)).toMatch(/wrongMove/);
  });
});
