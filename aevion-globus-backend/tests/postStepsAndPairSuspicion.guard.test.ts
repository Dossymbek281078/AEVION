import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 РОЛИК МЕРЯЕТСЯ ДЕЙСТВИЯМИ ЧЕЛОВЕКА, А ВИЗИТЫ ПО МЕТКЕ ЛЮДЕЙ НЕ ОТЛИЧАЮТ.
 *
 * Замер окна 91 (11.10.2026): все 16 меток `komm-*` и 3 метки `otvet-*` дали
 * РОВНО ПО 2 визита; пять меток, опубликованных в 20:29, через две минуты уже
 * имели по 2; отсев роботов их не поймал — `visitsOurs: 0`, то есть воронка
 * считала их живыми. Признак машины здесь — ровность числа по 21 метке.
 *
 * Моя собственная проверка этого признака на проде добавила к нему важное: из
 * 46 меток «ровно с 2 визитами» 14 имели `tried`, и это НЕ опровержение, а
 * подтверждение — `feature_use` шлёт автомат при заходе по `?puzzle=` (нашло
 * окно 37: 22 сессии из 22 с `tried` при нуле в `byChessPlies`). Значит `tried`
 * человеческим шагом считать нельзя.
 *
 * Отсюда две части этого сторожа:
 *   1. В `byPost` есть ступени, которые машина по адресу не шлёт: `progressed`,
 *      `puzzleSolved`, `waitlistSubmitted`, плюс `engaged` как самый дешёвый
 *      человеческий признак.
 *   2. Признак «ровно пара на метку» СЧИТАЕТСЯ, но НИЧЕГО НЕ ОТСЕИВАЕТ: числа
 *      выше остаются как были. Отсев сессии с одним просмотром запрещён моим же
 *      правилом (человек, закрывший страницу сразу, выглядит так же), а
 *      надёжность признака проверяется на проде его собственным числом.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-post-steps-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();
const минутуНазад = (м: number) => new Date(Date.now() - м * 60 * 1000).toISOString();

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
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

/** Событие сессии, пришедшей по метке ролика `пост`. */
function соб(sid: string, type: string, пост: string, ts = сейчас(), путь = "/cyberchess") {
  return { type, ts, sid, path: `${путь}?c=yt`, meta: { channel: "youtube", post: пост } };
}

describe("ступени человека в разрезе постов", () => {
  it("🔴 ролик виден по действиям: progressed, puzzleSolved, waitlistSubmitted, engaged", async () => {
    журнал([
      соб("живой", "page_view", "komm-1tpvr"),
      соб("живой", "engaged", "komm-1tpvr"),
      соб("живой", "game_progress", "komm-1tpvr"),
      соб("живой", "puzzle_solved", "komm-1tpvr"),
      соб("живой", "waitlist_submit", "komm-1tpvr"),
      // Наша проба по той же метке: должна быть названа отдельно.
      {
        type: "page_view",
        ts: сейчас(),
        sid: "наш",
        path: "/cyberchess?c=yt&probe=okno",
        meta: { channel: "youtube", post: "komm-1tpvr" },
      },
      соб("наш", "puzzle_solved", "komm-1tpvr"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    const п = r.body.byPost["youtube/komm-1tpvr"];
    expect(п, "строки поста нет").toBeTruthy();
    expect(п.engaged).toBe(1);
    expect(п.engagedOurs).toBe(0);
    expect(п.progressed).toBe(1);
    expect(п.puzzleSolved).toBe(2);
    expect(п.puzzleSolvedOurs, "наша проба не отделена").toBe(1);
    expect(п.waitlistSubmitted).toBe(1);
    expect(п.waitlistSubmittedOurs).toBe(0);
    // Живое по каждой ступени считается вычитанием, как у соседей.
    expect(п.puzzleSolved - п.puzzleSolvedOurs).toBe(1);
  });

  it("🔴 `tried` человеческим шагом НЕ считается — он есть, а действий нет", async () => {
    /*
     * Так выглядит машинный заход по `?puzzle=`: страница сама шлёт
     * `feature_use`, и прежний разрез показывал бы «ролик привёл попробовавших».
     * Новые ступени обязаны остаться нулевыми — только это и отличает машину.
     */
    журнал([
      соб("машина-1", "page_view", "komm-2ckac"),
      соб("машина-1", "feature_use", "komm-2ckac"),
      соб("машина-2", "page_view", "komm-2ckac"),
      соб("машина-2", "feature_use", "komm-2ckac"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/komm-2ckac"];
    expect(п.tried, "tried должен быть, иначе сценарий не тот").toBe(2);
    expect(п.engaged).toBe(0);
    expect(п.progressed).toBe(0);
    expect(п.puzzleSolved).toBe(0);
    expect(п.waitlistSubmitted).toBe(0);
  });

  it("🔴 «ноль подписок» отличается от «ноль показов» — знаменатель по метке", async () => {
    /*
     * Просьба окна 16 и его довод: без показов нуль подписок трактовать нельзя.
     * Три метки в одном наборе: у первой форму видели и адрес не оставили, у
     * второй оставили, у третьей форму не видели вовсе. Прежде первая и третья
     * давали одинаковое «0 подписок» — и это были РАЗНЫЕ ответы.
     */
    журнал([
      соб("видел", "page_view", "komm-pokaz"),
      соб("видел", "waitlist_offer_shown", "komm-pokaz"),
      соб("оставил", "page_view", "komm-podpiska"),
      соб("оставил", "waitlist_offer_shown", "komm-podpiska"),
      соб("оставил", "waitlist_submit", "komm-podpiska"),
      соб("не-видел", "page_view", "komm-bez-pokaza"),
      // Наша проба, которой форму тоже показали: мутация «не считать наших у
      // показов» без этого случая выживала — наш прогон шёл бы в живые.
      {
        type: "page_view",
        ts: сейчас(),
        sid: "наш",
        path: "/cyberchess?c=yt&probe=okno",
        meta: { channel: "youtube", post: "komm-pokaz" },
      },
      соб("наш", "waitlist_offer_shown", "komm-pokaz"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const видели = r.body.byPost["youtube/komm-pokaz"];
    const оставили = r.body.byPost["youtube/komm-podpiska"];
    const безПоказа = r.body.byPost["youtube/komm-bez-pokaza"];
    expect(видели.offerShown, "показ формы не посчитан по метке").toBe(2);
    expect(видели.offerShownOurs, "наша проба у показов не отделена").toBe(1);
    expect(видели.offerShown - видели.offerShownOurs, "живых показов вышло не столько").toBe(1);
    expect(видели.waitlistSubmitted).toBe(0);
    expect(оставили.offerShown).toBe(1);
    expect(оставили.waitlistSubmitted).toBe(1);
    expect(безПоказа.offerShown).toBe(0);
    expect(безПоказа.waitlistSubmitted).toBe(0);
    // Решающее: нуль подписок у первой метки и у третьей — РАЗНЫЕ случаи.
    expect(видели.offerShown, "два нуля остались неразличимы").not.toBe(безПоказа.offerShown);
  });

  it("единица — сессия: два решения одного человека это один", async () => {
    журнал([
      соб("один", "page_view", "komm-36ij9"),
      соб("один", "puzzle_solved", "komm-36ij9"),
      соб("один", "puzzle_solved", "komm-36ij9"),
      соб("один", "game_progress", "komm-36ij9"),
      соб("один", "game_progress", "komm-36ij9"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/komm-36ij9"];
    expect(п.puzzleSolved).toBe(1);
    expect(п.progressed).toBe(1);
  });
});

describe("проверочный заход окна с меткой ролика", () => {
  it("🔴 метка поста СОХРАНЯЕТСЯ, а сессия считается нашей — через ?probe=", async () => {
    /*
     * Развилка окна 16 (11.10.2026): чтобы проверить byPost живым заходом, метка
     * должна нести ПОСТ (?c=yt-chess-probe16 → канал youtube, пост chess-probe16),
     * но под «нашу метку» такая строка не подходит — и проверочный заход лёг бы
     * живым человеком, ровно как те числа, которые мы сегодня отменяли.
     *
     * Расширять правило «наша метка» НЕ НУЖНО: у нас уже есть ВТОРАЯ примета,
     * независимая от канала, — параметр ?probe=<окно> (и флаг probe в теле). Она
     * специально сделана отдельной, чтобы один признак не отвечал на два
     * вопроса. Значит проверочный заход выглядит так:
     *     /cyberchess?puzzle=<id>&c=yt-chess-probe16&probe=16
     * канал и пост сохраняются, сессия помечена нашей, числа не портятся.
     *
     * Этот сторож закрепляет поведение: иначе следующее окно снова придёт с той
     * же развилкой, а я снова буду вспоминать, почему расширять метку не надо.
     */
    журнал([
      {
        type: "page_view",
        ts: сейчас(),
        sid: "окно16",
        path: "/cyberchess?puzzle=abc&c=yt-chess-probe16&probe=16",
        meta: { channel: "youtube", post: "chess-probe16" },
      },
      {
        type: "game_progress",
        ts: сейчас(),
        sid: "окно16",
        path: "/cyberchess",
        meta: { channel: "youtube", post: "chess-probe16", plies: 1 },
      },
      // Живой человек по той же метке — чтобы было видно, что вычитание работает.
      соб("живой", "page_view", "chess-probe16"),
      соб("живой", "game_progress", "chess-probe16"),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/chess-probe16"];
    expect(п, "строки поста нет — метка с постом не сохранилась").toBeTruthy();
    expect(п.visits).toBe(2);
    expect(п.visitsOurs, "заход окна не зачтён нашим").toBe(1);
    expect(п.progressed).toBe(2);
    expect(п.progressedOurs, "ход окна не зачтён нашим").toBe(1);
    expect(п.progressed - п.progressedOurs, "живых ходов вышло не столько").toBe(1);
  });

  it("КОНТРОЛЬ: без ?probe= тот же заход считается ЖИВЫМ", async () => {
    // Это и есть доказательство, что пометку делает параметр, а не имя метки:
    // ровно та же строка метки без probe= даёт живого человека.
    журнал([
      {
        type: "page_view",
        ts: сейчас(),
        sid: "безпробы",
        path: "/cyberchess?puzzle=abc&c=yt-chess-probe16",
        meta: { channel: "youtube", post: "chess-probe16" },
      },
      {
        type: "game_progress",
        ts: сейчас(),
        sid: "безпробы",
        path: "/cyberchess",
        meta: { channel: "youtube", post: "chess-probe16", plies: 1 },
      },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/chess-probe16"];
    expect(п.visitsOurs).toBe(0);
    expect(п.progressedOurs).toBe(0);
  });
});

describe("подозрение «пара на метку»", () => {
  it("🔴 пара сессий без действий замечена и МЕТКА НАЗВАНА", async () => {
    журнал([
      соб("м1", "page_view", "komm-novaya", минутуНазад(3)),
      соб("м2", "page_view", "komm-novaya", минутуНазад(2)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern, "признак не посчитан").toBe(2);
    expect(r.body.sessionsSuspectedPairPatternTags).toContain("komm-novaya");
    expect(r.body.sessionsSuspectedPairPatternWhy).toMatch(/ПОДОЗРЕНИЕ|подозрен/i);
  });

  it("🔴 подозрение НИЧЕГО не отсеивает: визиты остались на месте", async () => {
    // Это главное утверждение. Отсеять сессию с одним просмотром нельзя:
    // человек, закрывший страницу сразу, выглядит так же.
    журнал([
      соб("м1", "page_view", "komm-novaya", минутуНазад(3)),
      соб("м2", "page_view", "komm-novaya", минутуНазад(2)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.byPost["youtube/komm-novaya"].visits, "визиты пропали — это отсев, а не счёт").toBe(2);
    expect(r.body.byChannel.youtube.visits).toBe(2);
    expect(r.body.botsExcludedByCrawlPattern, "сессии ушли в отсев обходчика").toBe(0);
  });

  it("🔴 КОНТРОЛЬ: метка с человеческим шагом под подозрение не идёт", async () => {
    журнал([
      соб("ч1", "page_view", "komm-zhivaya", минутуНазад(3)),
      соб("ч1", "puzzle_solved", "komm-zhivaya", минутуНазад(3)),
      соб("ч2", "page_view", "komm-zhivaya", минутуНазад(2)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern, "метку с действием зачли машиной").toBe(0);
    expect(r.body.sessionsSuspectedPairPatternTags).not.toContain("komm-zhivaya");
  });

  it("🔴 КОНТРОЛЬ: `feature_use` от подозрения НЕ спасает", async () => {
    // Иначе признак будет слеп к ровно тому случаю, ради которого написан:
    // машинный заход по `?puzzle=` шлёт feature_use сам.
    журнал([
      соб("м1", "page_view", "komm-puzzle", минутуНазад(3)),
      соб("м1", "feature_use", "komm-puzzle", минутуНазад(3)),
      соб("м2", "page_view", "komm-puzzle", минутуНазад(2)),
      соб("м2", "feature_use", "komm-puzzle", минутуНазад(2)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern).toBe(2);
    expect(r.body.sessionsSuspectedPairPatternTags).toContain("komm-puzzle");
  });

  it("КОНТРОЛЬ: ОДНА сессия на метку — не подозрение", async () => {
    журнал([соб("один", "page_view", "komm-odin", минутуНазад(3))]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern).toBe(0);
  });

  it("КОНТРОЛЬ: три сессии на метку — не подозрение (признак именно о паре)", async () => {
    журнал([
      соб("а", "page_view", "komm-tri", минутуНазад(3)),
      соб("б", "page_view", "komm-tri", минутуНазад(2)),
      соб("в", "page_view", "komm-tri", минутуНазад(1)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern).toBe(0);
  });

  it("КОНТРОЛЬ: пара, разнесённая на часы, под подозрение не идёт", async () => {
    журнал([
      соб("д1", "page_view", "komm-daleko", минутуНазад(300)),
      соб("д2", "page_view", "komm-daleko", минутуНазад(5)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern, "окно времени не проверяется").toBe(0);
  });

  it("КОНТРОЛЬ: пара, ходившая по двум адресам, под подозрение не идёт", async () => {
    журнал([
      соб("х1", "page_view", "komm-hodil", минутуНазад(3)),
      соб("х1", "page_view", "komm-hodil", минутуНазад(3), "/pricing"),
      соб("х2", "page_view", "komm-hodil", минутуНазад(2)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern).toBe(0);
  });
});
