import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 ОСЬ ПОСТОВ ОТВЕЧАЕТ «КАКОЙ РОЛИК ДОВЁЛ ДО КАССЫ И ЖИВОЙ ЛИ ОН».
 *
 * Повод — задание оркестратора 12.10.2026 разобрать три живых «начала оплаты»
 * за 14 дней. По оси постов ответить было НЕЛЬЗЯ: в строке поста стояли только
 * `checkoutStart` и `paid`, без оси «наши» и без признаков обрыва. Живое число
 * я вывел ИСКЛЮЧЕНИЕМ через канал — у youtube наших оказалось 0, значит оба
 * поста живые. Исключение держится только на этом нуле: один наш заход в канал,
 * и ответа не стало бы вовсе.
 *
 * Цена дыры именно здесь: решение «из 32 постов работает один» принимается на
 * оси постов, а она показывала начало оплаты, не умея сказать, наше оно или
 * человеческое.
 *
 * ⚠️ ДВЕ РАЗНЫЕ ЕДИНИЦЫ, и это проверяется отдельно, чтобы следующий не
 * «поправил» одну по образцу другой:
 *   - `checkoutStartOurs`, `thankYouOpened`, `paidOurs` начисляются ПО СОБЫТИЮ,
 *     то есть пост берётся из `meta` самого события (как у канала);
 *   - `checkoutStartNoSignal` начисляется ПО СЕССИИ, и пост берётся из ПЕРВОГО
 *     КАСАНИЯ сессии.
 * Поэтому у события оплаты метка поста обязана быть на самом событии.
 *
 * Сторож делает запрос к ручке и судит ТЕЛО ответа (0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС):
 * прежние разрезы уже один раз считались верно и не доезжали до `res.json`.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-post-axis-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();
const ПОСТ = "youtube/grey-hair-biomarker";
const ПОСТ2 = "youtube/med-sediny-2";

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

/** Первое касание: именно оно задаёт пост сессии для сессионных полей. */
function вход(sid: string, пост = "grey-hair-biomarker", наш = false) {
  return {
    type: "page_view",
    ts: сейчас(),
    sid,
    path: наш ? "/qmelanin?c=probe-okno85" : "/qmelanin?c=yt",
    meta: { channel: "youtube", post: пост },
  };
}

function событие(sid: string, тип: string, meta: Record<string, unknown> = {}, path = "/qmelanin") {
  return {
    type: тип,
    ts: сейчас(),
    sid,
    path,
    meta: { channel: "youtube", post: "grey-hair-biomarker", ...meta },
  };
}

async function разрез() {
  const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
  expect(r.status).toBe(200);
  expect(r.body.byPost, "разрез по постам не доехал до тела ответа").toBeTruthy();
  return { тело: r.body, пост: r.body.byPost[ПОСТ], пост2: r.body.byPost[ПОСТ2], канал: r.body.byChannel.youtube };
}

describe("ось постов отвечает про кассу", () => {
  it("🔴 четыре поля ЕСТЬ в строке поста, числами", async () => {
    журнал([вход("кто-то"), событие("кто-то", "checkout_start")]);
    const { пост } = await разрез();
    for (const имя of [
      "checkoutStartOurs",
      "checkoutStartNoSignal",
      "thankYouOpened",
      "paidOurs",
    ]) {
      expect(typeof пост[имя], `поля ${имя} в строке поста нет вовсе`).toBe("number");
    }
  });

  it("🔴 наше начало оплаты отделено от живого НА ОДНОМ посте", async () => {
    // Ровно случай, которого не хватило 12.10: два начала с одного ролика,
    // одно наше. Прежде ось постов показывала «2» и молчала о том, что одно
    // из них — проба.
    журнал([
      вход("живой"),
      событие("живой", "checkout_start"),
      вход("наш", "grey-hair-biomarker", true),
      событие("наш", "checkout_start"),
    ]);
    const { пост } = await разрез();
    expect(пост.checkoutStart).toBe(2);
    expect(пост.checkoutStartOurs, "наша проба не отделена — она прочтётся покупателем").toBe(1);
    expect(пост.checkoutStart - пост.checkoutStartOurs, "живое число не восстанавливается").toBe(1);
  });

  it("🔴 ПЕРЕВЕС: двое живых и один наш — иначе перевёрнутый предикат неотличим", async () => {
    /*
     * Мутация «`!нашиСессии.has(ev.sid)`» ВЫЖИЛА на сценарии «один живой, один
     * наш»: перевёрнутый предикат считает там ровно одного, то есть даёт то же
     * число при противоположном смысле. Сценарий без перевеса не охраняет
     * направление вычета — а направление здесь и есть весь ответ: при обмене
     * местами «живых» и «наших» доклад назвал бы пробу покупателем.
     */
    журнал([
      вход("живой-1"),
      событие("живой-1", "checkout_start"),
      вход("живой-2"),
      событие("живой-2", "checkout_start"),
      вход("наш", "grey-hair-biomarker", true),
      событие("наш", "checkout_start"),
    ]);
    const { пост, канал } = await разрез();
    expect(пост.checkoutStart).toBe(3);
    expect(пост.checkoutStartOurs, "наших не 1 — предикат считает не тех").toBe(1);
    expect(пост.checkoutStart - пост.checkoutStartOurs, "живых вышло не двое").toBe(2);
    expect(пост.checkoutStartOurs, "ось постов разошлась с каналом на перевесе").toBe(
      канал.checkoutStartOurs,
    );
  });

  it("🔴 ось постов и ось каналов отвечают ОДИНАКОВО про одно событие", async () => {
    /*
     * Главная защита от расхождения предикатов: поля у поста и у канала
     * начисляются двумя разными строками кода, и разъехавшись, они дадут
     * разные ответы на один вопрос. Все события здесь — один пост одного
     * канала, поэтому числа обязаны совпасть до единицы.
     */
    журнал([
      вход("живой"),
      событие("живой", "checkout_start"),
      вход("наш", "grey-hair-biomarker", true),
      событие("наш", "checkout_start"),
      событие("наш", "checkout_success"),
    ]);
    const { пост, канал } = await разрез();
    for (const имя of ["checkoutStart", "checkoutStartOurs", "thankYouOpened"]) {
      expect(пост[имя], `ось постов и ось каналов разошлись по ${имя}`).toBe(канал[имя]);
    }
  });

  it("🔴 возврат на страницу «спасибо» виден у поста", async () => {
    журнал([вход("вернулся"), событие("вернулся", "checkout_start"), событие("вернулся", "checkout_success")]);
    const { пост } = await разрез();
    expect(пост.thankYouOpened, "по посту не видно, доехал ли человек до возврата").toBe(1);
    // И контроль смысла: возврат — НЕ оплата. Иначе доклад назовёт деньгами
    // загрузку страницы, как это уже было у разреза по каналам.
    expect(пост.paid, "возврат зачтён оплатой").toBe(0);
  });

  it("🔴 оборвалось ДО возврата — ноль, а не отсутствие поля", async () => {
    журнал([вход("ушёл"), событие("ушёл", "checkout_start")]);
    const { пост } = await разрез();
    expect(пост.checkoutStart).toBe(1);
    expect(пост.thankYouOpened).toBe(0);
    expect(пост.paid).toBe(0);
  });

  it("🔴 наша оплата отделена по признаку «свой»", async () => {
    журнал([
      вход("наш", "grey-hair-biomarker", true),
      событие("наш", "payment_confirmed", { свой: true }),
      вход("живой"),
      событие("живой", "payment_confirmed"),
    ]);
    const { пост, канал } = await разрез();
    expect(пост.paid).toBe(2);
    expect(пост.paidOurs, "наша оплата не отделена").toBe(1);
    expect(пост.paidOurs, "предикат оплаты разошёлся с каналом").toBe(канал.paidOurs);
  });

  it("КОНТРОЛЬ: оплата без признака «свой» нашей не считается", async () => {
    журнал([вход("живой"), событие("живой", "payment_confirmed", { свой: "true" })]);
    const { пост } = await разрез();
    expect(пост.paid).toBe(1);
    expect(пост.paidOurs, "строка «true» зачтена признаком").toBe(0);
  });

  it("🔴 «нажал Купить без признаков жизни» виден у поста", async () => {
    // Профиль, которым 12.10 отделились два «живых» начала 07.10 от человека
    // 30.09: цены не смотрел, внимания нет, одна страница.
    журнал([вход("ткнул"), событие("ткнул", "checkout_start")]);
    const { пост, канал } = await разрез();
    expect(пост.checkoutStartNoSignal, "обходчик, нажавший «Купить», неотличим от покупателя").toBe(1);
    expect(пост.checkoutStartNoSignal).toBe(канал.checkoutStartNoSignal);
  });

  it("🔴 КОНТРОЛЬ признака: посмотрел цены — признаков жизни ЕСТЬ", async () => {
    журнал([
      вход("человек"),
      {
        type: "page_view",
        ts: сейчас(),
        sid: "человек",
        path: "/pricing",
        meta: { channel: "youtube", post: "grey-hair-biomarker" },
      },
      событие("человек", "checkout_start", {}, "/pricing"),
    ]);
    const { пост } = await разрез();
    expect(пост.checkoutStart).toBe(1);
    expect(пост.checkoutStartNoSignal, "живой заход назван безжизненным").toBe(0);
  });

  it("🔴 КОНТРОЛЬ признака: внимание 10 с — признаков жизни ЕСТЬ", async () => {
    журнал([
      вход("читал"),
      событие("читал", "engaged", { причина: "время" }),
      событие("читал", "checkout_start"),
    ]);
    const { пост } = await разрез();
    expect(пост.checkoutStartNoSignal).toBe(0);
  });

  it("🔴 два безжизненных начала РАЗВЕДЕНЫ по двум роликам", async () => {
    /*
     * Ради этого поле и заводится на оси постов: на канале youtube таких начал
     * было два, и канал не мог сказать, пришли они с одного ролика или с
     * разных. Ответ меняет вывод: один ролик — похоже на один обходчик по
     * ссылке; два — похоже на обход всей витрины.
     */
    журнал([
      вход("первый", "grey-hair-biomarker"),
      событие("первый", "checkout_start"),
      вход("второй", "med-sediny-2"),
      событие("второй", "checkout_start", { post: "med-sediny-2" }),
    ]);
    const { пост, пост2, канал } = await разрез();
    expect(пост.checkoutStartNoSignal).toBe(1);
    expect(пост2.checkoutStartNoSignal, "второй ролик не получил своего числа").toBe(1);
    expect(канал.checkoutStartNoSignal, "канал считает иначе, чем сумма постов").toBe(2);
  });

  it("🔴 единица — СЕССИЯ: два нажатия одного человека это одно начало", async () => {
    журнал([вход("дважды"), событие("дважды", "checkout_start"), событие("дважды", "checkout_start")]);
    const { пост } = await разрез();
    expect(пост.checkoutStartNoSignal, "нажатия сложились вместо сессии").toBe(1);
  });

  it("🔴 ОСТАТОК ДЫРЫ НАЗВАН: каких полей канала у поста ещё нет", async () => {
    /*
     * Сторож со знаменателем: он краснеет и когда одно из четырёх полей
     * пропадёт обратно, и когда кто-то закроет остаток — тогда список надо
     * сократить осознанно, а не обнаружить через две недели на разборе.
     *
     * 12.10.2026 разрыв был 13 полей; четыре закрыты, остаётся девять.
     */
    const ОСТАЛОСЬ = [
      "checkoutStartSessions",
      "checkoutStartSessionsOurs",
      "finished",
      "finishedOurs",
      "finishedWithoutMoves",
      "clicked",
      "clickedOurs",
      "dailyOpened",
      "dailyOpenedOurs",
    ];
    журнал([вход("кто-то"), событие("кто-то", "checkout_start")]);
    const { пост, канал } = await разрез();
    const нетУПоста = Object.keys(канал).filter((k) => !(k in пост));
    expect(
      нетУПоста.slice().sort(),
      "разрыв между осями изменился — закрой или обнови список осознанно",
    ).toEqual(ОСТАЛОСЬ.slice().sort());
  });
});
