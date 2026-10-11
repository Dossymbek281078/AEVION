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

describe("происхождение канала и поста", () => {
  it("🔴 метка ТОЛЬКО в адресе: «наше» ставится, а канала и поста НЕТ", async () => {
    /*
     * Замер окна 16 на проде 11.10.2026: их первая проба шла прямым POST с
     * верным адресом (c=yt-chess-probe16 и probe=16 в пути), но БЕЗ meta — и
     * легла в канал direct, в byPost её не было вовсе. То есть общее правило
     * «при прямом POST писать метку в path» помечает пробу нашей, но отправляет
     * её ровно в «прямые заходы», от которых правило и защищало.
     *
     * ⚠️ Сторож закрепляет ПОВЕДЕНИЕ, а не дефект. Чинить разбором метки на
     * сервере нельзя: каталог каналов живёт на фронте (lib/products.ts), и его
     * вторая копия здесь стала бы вторым источником правды — они расходятся при
     * первой правке. Правильное исправление у отправителя: meta {channel, post}.
     * Если кто-то решит «починить» это на сервере, сторож покраснеет и заставит
     * прочитать причину.
     */
    журнал([
      { type: "page_view", ts: сейчас(), sid: "безмета", path: "/cyberchess?c=yt-chess-probe16&probe=16" },
      { type: "game_progress", ts: сейчас(), sid: "безмета", path: "/cyberchess", meta: { plies: 1 } },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(Object.keys(r.body.byPost), "пост появился без meta.post").toEqual([]);
    const прямые = r.body.byChannel.direct;
    expect(прямые, "строки канала direct нет").toBeTruthy();
    expect(прямые.visits).toBe(1);
    expect(прямые.visitsOurs, "примета probe= в пути перестала работать").toBe(1);
    // И ответ сам объясняет это читателю, а не оставляет догадываться.
    expect(r.body.byPostAttributionNote).toMatch(/meta/);
    expect(r.body.byPostAttributionNote).toMatch(/webdriver/);
  });

  it("🔴 с meta {channel, post} та же проба попадает в byPost", async () => {
    // Контроль к предыдущему: разница РОВНО в наличии meta, и ни в чём больше.
    журнал([
      {
        type: "page_view",
        ts: сейчас(),
        sid: "сметой",
        path: "/cyberchess?c=yt-chess-probe16&probe=16",
        meta: { channel: "youtube", post: "chess-probe16" },
      },
      {
        type: "game_progress",
        ts: сейчас(),
        sid: "сметой",
        path: "/cyberchess",
        meta: { channel: "youtube", post: "chess-probe16", plies: 1 },
      },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    const п = r.body.byPost["youtube/chess-probe16"];
    expect(п, "строки поста нет при наличии meta").toBeTruthy();
    expect(п.visitsOurs).toBe(1);
    expect(п.progressedOurs).toBe(1);
  });

  it("🔴 сессия с webdriver:true в разрез НЕ попадает — браузерная проба невидима", async () => {
    /*
     * Второе наблюдение окна 16, и оно ломает способ ПРИЁМКИ, а не продукт:
     * настоящий playwright-заход по правильному адресу не даёт строки НИКОГДА,
     * потому что клиент ставит в тело webdriver:true, а воронка такие сессии
     * отсеивает до разрезов. Значит проверять разрез постов браузером нельзя —
     * только прямым POST с meta или живыми людьми. Закрепляю, чтобы не
     * предложить снова «прогоните браузером и покажите строку».
     */
    журнал([
      {
        type: "page_view",
        ts: сейчас(),
        sid: "playwright",
        path: "/cyberchess?c=yt-chess-probe16&probe=16",
        webdriver: true,
        meta: { channel: "youtube", post: "chess-probe16" },
      },
      {
        type: "game_progress",
        ts: сейчас(),
        sid: "playwright",
        path: "/cyberchess",
        webdriver: true,
        meta: { channel: "youtube", post: "chess-probe16", plies: 1 },
      },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(
      r.body.byPost["youtube/chess-probe16"],
      "управляемый браузер попал в разрез",
    ).toBeUndefined();
    expect(
      r.body.botsExcludedByWebdriver,
      "отсев по признаку управления не сработал",
    ).toBeGreaterThanOrEqual(1);
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

  it("🔴 РАЗНЫЕ строки браузера — не подозрение, и это видно числом", async () => {
    /*
     * Третье условие признака, которое просило окно 91 и которое само проверить
     * не смогло: публичной ручки со строкой браузера нет и не будет (рядом живёт
     * сторож publicFunnelHasNoPersonalData). Внутри она есть, поэтому условие
     * проверяется тут. Оно только СУЖАЕТ признак: пара с разными браузерами под
     * подозрение не идёт, и число таких пар отдаётся отдельно — иначе нельзя
     * узнать, работает ли условие или просто ничего не отсекает.
     */
    const другой = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1";
    writeFileSync(
      файл,
      [
        { ua: UA, ...соб("бр1", "page_view", "komm-raznye", минутуНазад(3)) },
        { ua: другой, ...соб("бр2", "page_view", "komm-raznye", минутуНазад(2)) },
      ]
        .map((о) => JSON.stringify(о))
        .join(String.fromCharCode(10)) + String.fromCharCode(10),
    );
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern, "пара с разными браузерами зачтена машиной").toBe(0);
    expect(
      r.body.sessionsSuspectedPairPatternRejectedDifferentUA,
      "условие по браузеру не названо числом — нельзя узнать, работает ли оно",
    ).toBe(1);
  });

  it("🔴 ВНИМАНИЕ от подозрения НЕ спасает — обходчик умеет ждать 10 секунд", async () => {
    /*
     * Поправка по замеру окна 91 (11.10.2026, ролик выложен в 21:17): у метки
     * ОПИСАНИЯ через 20 минут было 2 визита, engaged 1 и НОЛЬ человеческих
     * шагов. То есть обходчик подождал десять секунд — ровно то, о чём
     * предупреждает комментарий у самого признака внимания в events.ts.
     *
     * Раньше engaged стоял у меня в наборе «шагов человека», и такая пара под
     * подозрение не шла: признак был слеп на том самом случае, ради которого
     * написан. Цена исправления названа рядом числом
     * (sessionsSuspectedPairPatternWithEngaged): пара живых людей, прочитавших
     * страницу и ушедших, тоже попадёт в подозрение, и по этому числу видно,
     * сколько их. Отсев по-прежнему не включён.
     */
    журнал([
      соб("вн1", "page_view", "chess-mat3-075iw", минутуНазад(18)),
      соб("вн1", "engaged", "chess-mat3-075iw", минутуНазад(18)),
      соб("вн2", "page_view", "chess-mat3-075iw", минутуНазад(17)),
      соб("вн2", "engaged", "chess-mat3-075iw", минутуНазад(17)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(
      r.body.sessionsSuspectedPairPattern,
      "внимание снова спасает от подозрения — признак слеп к обходчику, ждущему 10 с",
    ).toBe(2);
    expect(
      r.body.sessionsSuspectedPairPatternWithEngaged,
      "цена отсева не названа числом",
    ).toBe(2);
    expect(r.body.sessionsSuspectedPairPatternTags).toContain("chess-mat3-075iw");
  });

  it("🔴 КОНТРОЛЬ: человеческий ШАГ от подозрения спасает, внимание — нет", async () => {
    // Разница ровно в одном событии: это и есть проверяемый признак.
    журнал([
      соб("ш1", "page_view", "chess-s-shagom", минутуНазад(18)),
      соб("ш1", "puzzle_solved", "chess-s-shagom", минутуНазад(18)),
      соб("ш2", "page_view", "chess-s-shagom", минутуНазад(17)),
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.sessionsSuspectedPairPattern).toBe(0);
    expect(r.body.sessionsSuspectedPairPatternWithEngaged).toBe(0);
  });

  it("🔴 оговорка про внимание стоит в ОТВЕТЕ, а не только в исходнике", async () => {
    // Просьба окна 91: её прочтёт тот, кто берёт поле, а не тот, кто читает код.
    журнал([соб("с", "page_view", "chess-lyuboy", минутуНазад(5))]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(typeof r.body.engagedNote, "оговорки про внимание нет в ответе").toBe("string");
    expect(r.body.engagedNote).toMatch(/НЕ доказывает человека/);
    expect(r.body.engagedNote, "не названо, что доказывает человека").toMatch(/puzzleSolved/);
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
