import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Что охраняет этот файл: «заплатил → получил ровно то, что купил».
 *
 * Три дефекта, найденные 12.08.2026 на живом магазине, все класса «отвечаем
 * 200, а делаем не то» — то есть без жалоб, без повторной доставки и без следа:
 *
 * 1. DevHub Studio Pro продаётся ПОДПИСКОЙ ($149/мес, is_subscription: true —
 *    проверено на витрине), а ссылки `app_devhub` в таблице вариантов не было.
 *    Обратный поиск возвращал null, и подписка за $149 провижинила тариф
 *    «lite» ($19).
 * 2. Отмена подписки на DevHub не забирала доступ: строка помечалась
 *    cancelled, а тариф в DevHubTier оставался "pro" навсегда.
 * 3. Сбой записи в БД глотался внутри, и ответ всё равно был 200 —
 *    магазин считал доставку успешной и не повторял её.
 */

const SECRET = "test-ls-secret-000";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO = "9001";
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "9002";

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

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return app;
}

let subCounter = 0;
function post(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(makeApp())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

function event(
  name: string,
  variantId: string | number,
  email = "buyer@test.aev",
  total?: number,
) {
  subCounter += 1;
  return {
    meta: { event_name: name },
    data: {
      id: `sub_${subCounter}`,
      attributes: {
        user_email: email,
        variant_id: variantId,
        ...(total === undefined ? {} : { total }),
      },
    },
  };
}

/** Все запросы к БД, попавшие в DevHubEmailTier, с выставленным тарифом. */
function devhubTiersWritten(): string[] {
  return mockQuery.mock.calls
    .filter((c) => String(c[0]).includes("DevHubEmailTier"))
    .map((c) => String((c[1] as unknown[])?.[1]));
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
});

describe("Lemon Squeezy: заплатил → получил именно купленное", () => {
  test("подписка на DevHub Studio Pro открывает DevHub, а не тариф lite", async () => {
    const res = await post(event("subscription_created", "9001"));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("app_activated");
    expect(res.body.appSlug).toBe("devhub");
    // Доступ открывает тариф в DevHubEmailTier — он должен стать "pro".
    expect(devhubTiersWritten()).toContain("pro");
    // И ни в коем случае не платформенный тариф вместо купленного модуля.
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("отмена подписки на DevHub забирает доступ", async () => {
    const res = await post(event("subscription_cancelled", "9001"));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("app_cancelled");
    expect(devhubTiersWritten()).toContain("free");
  });

  test("неизвестный товар НЕ превращается в тариф наугад — 500, а не тихий 200", async () => {
    const res = await post(event("subscription_created", "777777"));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("unmapped_variant");
    expect(res.body.variantId).toBe("777777");
    // Главное: ничего не выдали. Раньше здесь молча провижинился "lite".
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("известный тариф по-прежнему провижинится", async () => {
    const res = await post(event("subscription_created", "9002"));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("activated");
    expect(mockProvision).toHaveBeenCalledTimes(1);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "lite", source: "lemonsqueezy" });
  });

  test("сбой записи в БД не отвечает 200 — иначе магазин не повторит доставку", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));

    const res = await post(event("subscription_created", "9001"));

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });

  test("возврат ЗАБИРАЕТ доступ к DevHub, а не оставляет его навсегда", async () => {
    // До 13.08.2026 слова «refund» в обработчике не было вовсе: деньги вернули,
    // доступ остался. У Gumroad это обработано, у Lemon Squeezy не было —
    // асимметрия нашлась сверкой двух рельсов.
    const res = await post({
      meta: { event_name: "order_refunded" },
      data: { id: "ord_1", attributes: { user_email: "buyer@test.aev", variant_id: "9001" } },
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("devhub_studio_pro_revoked");
    expect(devhubTiersWritten()).toContain("free");
  });

  test("разовая покупка по-прежнему открывает доступ", async () => {
    const res = await post({
      meta: { event_name: "order_created" },
      data: { id: "ord_2", attributes: { user_email: "buyer@test.aev", variant_id: "9001" } },
    });

    expect(res.body.action).toBe("devhub_studio_pro_activated");
    expect(devhubTiersWritten()).toContain("pro");
  });
});

/**
 * Сумма списания: два случая без законного прочтения.
 *
 * ЗАМЕР 01.09.2026 (находка соседнего окна, проверена здесь заново): вебхук не
 * касался суммы ВООБЩЕ — грепом 0 упоминаний total/amount/price при 20 у слов
 * variant/custom/order, то есть прибор не слеп. Тариф выводился только из
 * variant_id, а сколько человек заплатил на самом деле, никто не смотрел.
 *
 * Точным равенством сверять нельзя: скидочный код делает меньшую сумму
 * законной, у годового периода она другая по устройству. Поэтому проверяются
 * только два случая:
 *
 *   ноль          — это не «дешевле», а доступ бесплатно;
 *   больше        — потолок взят как годовая стоимость по МЕСЯЧНОЙ цене:
 *   потолка         годовой тариф у нас дешевле двенадцати месяцев, скидки
 *                   только уменьшают, значит выше границы законного прочтения
 *                   нет.
 *
 * Переплата опаснее, чем кажется: НАШ экран успеха показывает ожидаемую сумму
 * из адреса возврата, а не списанную. Человек, с которого взяли больше, у нас
 * увидит меньшую цифру и пойдёт спорить с банком, а не с нами.
 *
 * Доступ не отбираем ни в одном случае — отказать оплатившему дороже.
 */
describe("Lemon Squeezy: сумма списания оставляет след, когда говорит сама за себя", () => {
  let warned: string[] = [];
  beforeEach(() => {
    warned = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      warned.push(a.map(String).join(" "));
    });
  });

  test("нулевая сумма у платного тарифа видна", async () => {
    const res = await post(event("subscription_created", "9002", "buyer@test.aev", 0));
    expect(res.status, "вебхук не принял пинг — дальше мерить нечего").toBe(200);
    expect(
      warned.join(" "),
      "доступ выдан бесплатно, и следа нет — снаружи неотличимо от обычной оплаты",
    ).toContain("БЕСПЛАТНО");
  });

  test("списание выше годового потолка видно", async () => {
    // Тариф lite: $19/мес → потолок $228. Списание $999 законного прочтения
    // не имеет ни при какой скидке и ни при каком периоде.
    const res = await post(event("subscription_created", "9002", "buyer@test.aev", 99900));
    expect(res.status).toBe(200);
    expect(warned.join(" "), "переплата прошла молча").toContain("БОЛЬШЕ обещанного");
  });

  test("фактически списанное записывается в подписку", async () => {
    // Поле amountUsd в записи подписки существовало давно и не заполнялось
    // НИКЕМ — оно молча исчезло бы, и никто бы не заметил. Пишем не впрок: у
    // него есть названный читатель — панель выручки соседнего окна, которая до
    // сих пор считает сумму из АДРЕСА ВОЗВРАТА, то есть нашу ожидаемую.
    await post(event("subscription_created", "9002", "buyer@test.aev", 1900));
    const arg = mockProvision.mock.calls.at(-1)?.[0] as { amountUsd?: number } | undefined;
    expect(arg?.amountUsd, "списанная сумма не дошла до записи подписки").toBe(19);
  });

  test("если суммы в событии нет — поле не выдумывается", async () => {
    // Отсутствие суммы у событий подписки нормально. Ноль или догадка здесь
    // были бы хуже пустоты: по ним потом посчитают выручку.
    await post(event("subscription_created", "9002", "nototal@test.aev"));
    const arg = mockProvision.mock.calls.at(-1)?.[0] as { amountUsd?: number } | undefined;
    expect(arg && "amountUsd" in arg, "поле проставлено там, где суммы не было").toBe(false);
  });

  test("контроль: обычная оплата и событие БЕЗ суммы следа не оставляют", async () => {
    // Без этого «след есть» означало бы «я пишу в журнал всегда». И отдельно
    // важно, что отсутствие поля тревогой не считается: у событий подписки
    // суммы может не быть по устройству провайдера.
    const ok = await post(event("subscription_created", "9002", "buyer@test.aev", 1900));
    expect(ok.status).toBe(200);
    const none = await post(event("subscription_created", "9002", "other@test.aev"));
    expect(none.status).toBe(200);
    const log = warned.join(" ");
    expect(log, "обычная оплата помечена как бесплатная").not.toContain("БЕСПЛАТНО");
    expect(log, "обычная оплата помечена как переплата").not.toContain("БОЛЬШЕ обещанного");
  });
});
