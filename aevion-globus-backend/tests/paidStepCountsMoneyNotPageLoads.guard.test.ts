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
function вебхукОбОплате() {
  счётчик += 1;
  const payload = {
    meta: { event_name: "subscription_created" },
    data: {
      id: `sub_paid_${счётчик}`,
      attributes: { user_email: `buyer${счётчик}@test.aev`, variant_id: "7003", total: 2400 },
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
    total: { checkoutStart: number; thankYouOpened: number; paid: number | null };
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
});
