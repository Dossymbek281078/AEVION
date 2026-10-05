import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * 402 на закрытом модуле ДОЛЖЕН различать два случая — иначе заплатившему
 * предлагают заплатить второй раз.
 *
 * 🔴 НАЙДЕНО 05.10.2026 (замер окна Связи). Человек, который УЖЕ оплатил, но
 * зашёл НЕ войдя (или под другим email), получал тот же 402, что и тот, у кого
 * покупок нет вовсе: «модуль входит в платную подписку → оформить». То есть
 * плательщику предлагали купить снова.
 *
 * Источник различия — НАЛИЧИЕ JWT (вошёл или нет):
 *   • не вошёл (JWT нет)      → возможно, уже оплатил; сперва вход под почтой
 *                               оплаты, доступ привязан к ней;
 *   • вошёл, но прав нет      → мог платить другим адресом; либо не оформлял.
 *
 * Дверь в обоих случаях закрыта (402) — меняется только то, что человек читает,
 * и появляется loginUrl, чтобы фронт показал кнопку входа, а не только «тарифы».
 *
 * Тест — ЗАПРОСОМ через реальный requireModule, на оба случая, с контролем.
 */

// Управляем планом И фактом JWT из одного места: что вернёт verifyBearerOptional.
// null = аноним; объект с email = вошедший без прав (план резолвится в free,
// т.к. нет payload.plan и нет активной подписки по этому email).
let jwtPayload: { email: string } | null = null;

vi.mock("../src/lib/authJwt", async (importActual) => {
  const actual = await importActual<typeof import("../src/lib/authJwt")>();
  return { ...actual, verifyBearerOptional: () => jwtPayload };
});

// База не нужна: «подписки на модуль нет» → доходим до upgradeResponse (402).
vi.mock("../src/lib/appEntitlements", () => ({
  appSubscriptionState: async () => "none" as const,
}));

// recordDeny — побочный эффект в журнал спроса; в тесте глушим.
vi.mock("../src/lib/paywallDenyLog", () => ({
  recordDeny: () => {},
  funnelSummary: async () => ({}),
}));

// eslint-disable-next-line import/first
import { requireModule } from "../src/lib/planGate";

async function прогнать(module: string) {
  let nexted = false;
  let status = 0;
  let body: any = null;
  const res: any = {
    status(c: number) { status = c; return this; },
    json(b: any) { body = b; return this; },
  };
  await requireModule(module)(
    { method: "GET", path: "/threads", headers: {} } as any,
    res,
    () => { nexted = true; },
  );
  return { nexted, status, body };
}

describe("402: текст разведён по наличию входа (JWT)", () => {
  const saved = { mods: process.env.PAYWALL_MODULES, off: process.env.PAYWALL_DISABLED };
  beforeEach(() => {
    // healthai, а не qcoreai: последний в списке «никогда не закрывать».
    process.env.PAYWALL_MODULES = "healthai";
    delete process.env.PAYWALL_DISABLED;
    jwtPayload = null;
  });
  afterEach(() => {
    if (saved.mods === undefined) delete process.env.PAYWALL_MODULES; else process.env.PAYWALL_MODULES = saved.mods;
    if (saved.off === undefined) delete process.env.PAYWALL_DISABLED; else process.env.PAYWALL_DISABLED = saved.off;
  });

  it("НЕ вошёл: 402, authState=anonymous, текст про вход под почтой оплаты + loginUrl", async () => {
    jwtPayload = null;
    const r = await прогнать("healthai");
    expect(r.nexted, "аноним прошёл сквозь стену").toBe(false);
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("upgrade_required");
    expect(r.body.authState).toBe("anonymous");
    expect(typeof r.body.loginUrl).toBe("string");
    expect(r.body.loginUrl).toContain("/auth?next=");
    // Ключевое: анониму сперва предлагают ВОЙТИ, а не «оформить».
    expect(r.body.message).toContain("войдите");
    expect(r.body.message.toLowerCase()).toContain("оплат");
  });

  it("вошёл, прав нет: 402, authState=authenticated, текст про другой адрес, НЕ тот же, что анониму", async () => {
    jwtPayload = { email: "loggedin-nopurchase@test.aev" };
    const r = await прогнать("healthai");
    expect(r.nexted, "вошедший без прав прошёл сквозь стену").toBe(false);
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("upgrade_required");
    expect(r.body.authState).toBe("authenticated");
    expect(typeof r.body.loginUrl).toBe("string");
    // Вошедшему говорят про ДРУГОЙ адрес оплаты, а не «вы не вошли».
    expect(r.body.message).toContain("другим адресом");
  });

  it("КОНТРОЛЬ: два текста РАЗНЫЕ (иначе разведение бессмысленно)", async () => {
    jwtPayload = null;
    const anon = (await прогнать("healthai")).body.message;
    jwtPayload = { email: "x@test.aev" };
    const auth = (await прогнать("healthai")).body.message;
    expect(anon).not.toBe(auth);
  });

  it("КОНТРОЛЬ: на ОТКРЫТОМ модуле запрос проходит (next), 402 не возникает", async () => {
    // qskyway не в PAYWALL_MODULES → стена спит → next(). Если здесь 402,
    // значит гейт закрывает всё подряд и «разные тексты» ничего не стоят.
    jwtPayload = null;
    const r = await прогнать("qskyway");
    expect(r.nexted).toBe(true);
    expect(r.status).toBe(0);
  });
});
