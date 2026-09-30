import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Сторож: ступень «оплатили» в воронке считает ДЕНЬГИ, а не загрузки страницы.
 *
 * 🔴 ЗАМЕР 29.09.2026, из-за которого сторож существует. Воронка впервые за
 * четырнадцать дней показала `paid: 2` — и это было неправдой. Событие
 * `checkout_success`, из которого считалась ступень, шлёт компонент
 * `PurchaseReturnTracker` при ЗАГРУЗКЕ страницы возврата с меткой успеха в
 * адресе. То есть любой, кто открыл адрес «спасибо» (включая наше же окно,
 * проверяющее путь возврата), добавлял единицу в «оплатили». Контроль: новых
 * подписок на проде в тот момент ноль, и ни одно из трёх окон, работавших в
 * тот день с кассой, эти два события за собой не признало.
 *
 * Класс дефекта дорогой: число называется деньгами, читается как деньги и
 * попадает в разговор с основателем — а измеряет показ экрана. Ровно так же
 * 20.09.2026 выяснилось, что воронка на 91 % состояла из нашей автоматики.
 *
 * ЧТО ИМЕННО ОХРАНЯЕТСЯ, тремя утверждениями:
 *   1. пришёл вебхук кассы → «оплатили» выросло (деньги видны);
 *   2. открыли страницу «спасибо» → «оплатили» НЕ выросло, выросло
 *      `thankYouOpened` (контроль в обратную сторону — без него сторож
 *      зеленел бы и на прежнем, ложном поведении);
 *   3. день раньше появления механизма → `null`, а не ноль: тогда оплату
 *      измерить было нечем, и ноль читался бы как «продаж не было».
 *
 * Путь проверяется НАСТОЯЩИЙ: подменён только файл хранилища (EVENTS_FILE).
 * Ни вебхук, ни воронка, ни функция записи не подменены — иначе сторож
 * охранял бы копию правила, а не работу (замер тех же дней: три сторожа
 * пропустили мутацию именно потому, что проверяли копию).
 */

const SECRET = "test-ls-secret-paid-step";
const каталог = mkdtempSync(join(tmpdir(), "aevion-paid-step-"));
const ФАЙЛ = join(каталог, "events.jsonl");

// Задаётся ДО импорта маршрутов: путь хранилища читается при загрузке модуля.
process.env.EVENTS_FILE = ФАЙЛ;
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_CYBERCHESS_LITE = "7003";

const { mockQuery, mockProvision } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
const { eventsRouter } = await import("../src/routes/events");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  a.use("/api/pricing/events", eventsRouter);
  return a;
}

let счётчик = 0;
/** Настоящий подписанный вебхук о покупке CyberChess на месяц. */
function вебхукОбОплате(почта?: string) {
  счётчик += 1;
  const payload = {
    meta: { event_name: "subscription_created" },
    data: {
      id: `sub_paid_${счётчик}`,
      attributes: { user_email: почта ?? `buyer${счётчик}@test.aev`, variant_id: "7003", total: 2400 },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(приложение())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

/** Настоящее событие браузера о том, что показалась страница «спасибо». */
function открылиСтраницуСпасибо() {
  return request(приложение())
    .post("/api/pricing/events")
    .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131")
    .send({ type: "checkout_success", source: "pricing", path: "/pricing/checkout/success" });
}

async function воронка() {
  const r = await request(приложение()).get("/api/pricing/events/funnel?days=14");
  expect(r.status).toBe(200);
  return r.body as {
    total: { checkoutStart: number; checkoutStartOurs: number; thankYouOpened: number; paid: number | null; paidOurs: number | null };
    paidMeasuredSince: string;
    byDay: { day: string; thankYouOpened: number; paid: number | null }[];
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
  writeFileSync(ФАЙЛ, "", "utf8");
});

afterAll(() => {
  delete process.env.EVENTS_FILE;
  rmSync(каталог, { recursive: true, force: true });
});

describe("ступень «оплатили» считает деньги", () => {
  test("вебхук кассы двигает «оплатили»", async () => {
    const до = await воронка();
    expect(до.total.paid).toBe(0);

    const r = await вебхукОбОплате();
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("app_activated");

    const после = await воронка();
    expect(после.total.paid, "подтверждение кассы обязано попасть в «оплатили»").toBe(1);
  });

  test("КОНТРОЛЬ: открытая страница «спасибо» деньгами не считается", async () => {
    const r = await открылиСтраницуСпасибо();
    expect(r.status).toBe(204);

    const ф = await воронка();
    expect(ф.total.thankYouOpened, "возврат человека виден отдельной ступенью").toBe(1);
    expect(
      ф.total.paid,
      "загрузка страницы возврата НЕ деньги: именно так 29.09 появились две ложные оплаты",
    ).toBe(0);
  });

  test("две страницы «спасибо» и одна оплата дают 2 и 1, а не 3", async () => {
    await открылиСтраницуСпасибо();
    await открылиСтраницуСпасибо();
    await вебхукОбОплате();

    const ф = await воронка();
    expect(ф.total.thankYouOpened).toBe(2);
    expect(ф.total.paid).toBe(1);
  });

  test("день раньше появления механизма отдаёт null, а не ноль", async () => {
    const раньше = new Date(Date.parse(await мера()) - 3 * 24 * 60 * 60 * 1000)
      .toISOString();
    const день = раньше.slice(0, 10);
    // Пишем в хранилище напрямую: нужен ДАВНИЙ день, а ручка ставит «сейчас».
    writeFileSync(
      ФАЙЛ,
      JSON.stringify({ ts: раньше, type: "page_view", path: "/pricing", sid: "s-old" }) +
        String.fromCharCode(10) +
        JSON.stringify({ ts: раньше, type: "checkout_success", source: "pricing" }) +
        String.fromCharCode(10),
      "utf8",
    );

    const ф = await request(приложение()).get("/api/pricing/events/funnel?days=30");
    const тело = ф.body as {
      total: { paid: number | null };
      paidWindowPartlyUnmeasured: boolean;
      byDay: { day: string; thankYouOpened: number; paid: number | null }[];
    };
    const строка = тело.byDay.find((д) => д.day === день);
    expect(строка, `в ответе нет дня ${день}`).toBeTruthy();
    expect(строка!.thankYouOpened, "возвраты за тот день посчитаны").toBe(1);
    expect(
      строка!.paid,
      "механизма учёта денег тогда не было — это «не знаю», а не «продаж не было»",
    ).toBeNull();
    expect(тело.paidWindowPartlyUnmeasured, "окно началось раньше механизма").toBe(true);
    expect(
      тело.total.paid,
      "сумма по измеренным дням — честный ноль, а не «не знаю»: сегодня учёт работает",
    ).toBe(0);
  });
});

/** Дата, с которой оплату вообще можно измерить, — берётся из ОТВЕТА, а не из
 *  копии константы в тесте: копия разошлась бы с кодом молча. */
async function мера(): Promise<string> {
  const r = await request(приложение()).get("/api/pricing/events/funnel?days=1");
  const since = (r.body as { paidMeasuredSince?: string }).paidMeasuredSince;
  expect(typeof since, "воронка обязана называть, с какого дня оплата измерима").toBe("string");
  return since as string;
}

describe("хранилище событий", () => {
  test("файл хранилища подменён на временный — боевой не тронут", () => {
    expect(process.env.EVENTS_FILE).toBe(ФАЙЛ);
    expect(existsSync(ФАЙЛ)).toBe(true);
    expect(readFileSync(ФАЙЛ, "utf8")).not.toContain("api.aevion.app");
  });
  test("наши собственные оплаты видны ОТДЕЛЬНЫМ числом, а не вычтены молча", async () => {
    // 🔴 Замер 29.09.2026: первые две подтверждённые оплаты были покупками самого
    // основателя, проверявшего кассу ($40 и $16). Число «оплатили: 2» прочиталось
    // бы как первые продажи, и это выяснялось перепиской между окнами.
    //
    // Проверяем ОБА числа: общее и «из них наши». Вычитание молча было бы хуже —
    // тогда ноль внешних продаж нельзя отличить от отсутствия оплат вообще.
    const своя = await вебхукОбОплате("founder@aevion.app");
    expect(своя.status).toBe(200);
    const чужая = await вебхукОбОплате("buyer@example.org");
    expect(чужая.status).toBe(200);

    const ф = await воронка();
    expect(ф.total.paid, "обе оплаты обязаны попасть в общее число").toBe(2);
    expect(
      ф.total.paidOurs,
      "наша оплата не отмечена — «первая продажа» опять решается перепиской",
    ).toBe(1);
  });
  test("начала оплаты с НАШЕЙ меткой канала отмечены отдельно", async () => {
    // 🔴 Замер 30.09.2026: за 14 дней «начали оплату: 5», и все пять оказались
    // нашими — окно страницы цен признало пять нажатий браузером, а в почте
    // нашлись ПЯТЬ писем кассы о брошенной корзине, все на probe-*@aevion.app.
    // Живых незавершённых покупок за две недели ноль, а число «5» читалось как
    // пятеро людей у карты.
    //
    // Метка живёт в адресе страницы, а событие «начали оплату» её не несёт —
    // связь идёт по sid. Поэтому тест шлёт СНАЧАЛА просмотр с меткой, потом
    // начало оплаты той же сессией, как это и происходит у человека.
    const свой = "sid-наш-1";
    const чужой = "sid-человек-1";
    await request(приложение()).post("/api/pricing/events")
      .set("User-Agent", "Mozilla/5.0 Chrome/131")
      .send({ type: "page_view", path: "/pricing?c=cold-visit-check", sid: свой });
    await request(приложение()).post("/api/pricing/events")
      .set("User-Agent", "Mozilla/5.0 Chrome/131")
      .send({ type: "page_view", path: "/pricing", sid: чужой });
    for (const sid of [свой, чужой]) {
      await request(приложение()).post("/api/pricing/events")
        .set("User-Agent", "Mozilla/5.0 Chrome/131")
        .send({ type: "checkout_start", source: "pricing", sid });
    }

    const ф = await воронка();
    expect(ф.total.checkoutStart, "оба начала обязаны попасть в общее число").toBe(2);
    expect(
      ф.total.checkoutStartOurs,
      "наше начало оплаты не отмечено — пятеро наших кликов снова прочитаются как пятеро людей",
    ).toBe(1);
  });
  test("ОТВЕТ РУЧКИ несёт все разрезы, а не только посчитанные внутри", async () => {
    // 🔴 Замер 30.09.2026 на проде: `byPost` и `byEntryPage` СЧИТАЛИСЬ, тесты были
    // зелёными, а в JSON их не было — ответ перечисляет поля поимённо, и я дописал
    // их в возврат функции, но не в сам ответ. Классика «написано, но не
    // вызывается», и мой сторож её не поймал, потому что проверял `разрезВоронки`,
    // а не ответ ручки. Здесь проверяется ИМЕННО ответ.
    await request(приложение()).post("/api/pricing/events")
      .set("User-Agent", "Mozilla/5.0 Chrome/131")
      .send({ type: "page_view", path: "/qskyway?c=ig-post1", sid: "s-post-1", meta: { channel: "instagram", post: "post1" } });

    const r = await request(приложение()).get("/api/pricing/events/funnel?days=14");
    expect(r.status).toBe(200);
    for (const поле of ["byChannel", "byApp", "byPost", "byEntryPage", "byHour"]) {
      expect(
        Object.prototype.hasOwnProperty.call(r.body, поле),
        `ответ не содержит ${поле} — разрез считается и выбрасывается`,
      ).toBe(true);
    }
    // И подпись про визиты: единственные читатели ручки — мы, и разницу «сумма по
    // каналам минус итог» нельзя читать как ошибку.
    expect(r.body.byChannelVisitsMayExceedTotal).toBe(true);
    expect(String(r.body.byChannelVisitsNote)).toMatch(/в пределах канала/i);

    // Часовой разрез: он и есть ответ на «когда был этот заход». До 30.09.2026
    // часы жили только в закрытой ручке (401), и «чей это заход» решалось
    // догадками. Проверяем, что час ЕСТЬ в ответе и что событие в него попало.
    expect(r.body.byHourTimezone, "часовой пояс не назван — часы прочитают как местные").toBe("UTC");
    const часы = r.body.byHour as { hour: string; visits: number }[];
    // Оговорка про сумму часов обязана быть В ОТВЕТЕ, а не в чьей-то памяти:
    // сессия через полночь попадает в два часа, и сложенные часы читаются как
    // «визиты за день» с завышением. У каналов такая подпись уже есть — здесь
    // проверяем симметрию, иначе один разрез честен, а соседний молчит.
    expect(
      r.body.byHourVisitsMayExceedTotal,
      "нет признака, что сумма по часам больше итога",
    ).toBe(true);
    expect(
      String(r.body.byHourVisitsNote ?? ""),
      "оговорка про часы не названа словами",
    ).toMatch(/В ПРЕДЕЛАХ часа/);
    expect(Array.isArray(часы), "byHour не массив").toBe(true);
    const текущийЧас = new Date().toISOString().slice(0, 13);
    expect(
      часы.some((ч) => ч.hour === текущийЧас && ч.visits > 0),
      `события нет в текущем часе ${текущийЧас}: ${JSON.stringify(часы).slice(0, 200)}`,
    ).toBe(true);
  });
});
