import { describe, test, expect } from "vitest";
import { разборBrevo, этоОк } from "../src/lib/providerSpendCheck";

/**
 * Остаток писем Brevo лежит в теле `/v3/account` — и обязан читаться.
 *
 * Повод: 05.10.2026 в 14:22 Brevo прислал «Your Brevo API keys have been
 * marked as inactive», а наша проверка в это же время отвечала
 * `brevo: ok, HTTP 200` — она смотрела только на код ответа. Через Brevo
 * идёт сбор адресов со ВСЕХ витрин, то есть слепота здесь стоит воронки.
 */

const ответ = (status: number, тело: unknown) => ({
  status,
  body: typeof тело === "string" ? тело : JSON.stringify(тело),
});

/** Форма, в которой отвечает сам Brevo. */
const планНаN = (credits: number) => ({
  email: "noreply@aevion.app",
  plan: [
    { type: "free", creditsType: "sendLimit", credits },
    // Запись по SMS к письмам отношения не имеет и не должна влиять на вердикт.
    { type: "sms", credits: 0 },
  ],
});

describe("Brevo: остаток писем — это ответ, а не украшение", () => {
  test("письма есть → ok, и в подписи видно сколько", () => {
    const r = разборBrevo(ответ(200, планНаN(280)));
    expect(r.состояние).toBe("ok");
    expect(этоОк(r.состояние)).toBe(true);
    expect(r.detail).toContain("280");
  });

  test("письма кончились → НЕ ok, хотя HTTP 200", () => {
    const r = разборBrevo(ответ(200, планНаN(0)));
    expect(r.состояние).toBe("нет денег");
    expect(этоОк(r.состояние), "исчерпанный лимит не должен красить панель зелёным").toBe(false);
  });

  test("нулевой SMS-счётчик НЕ делает почту мёртвой", () => {
    // Запись sms: credits 0 стоит рядом всегда. Если её посчитать, панель
    // будет вечно красной при живой почте — а к вечно красному не ходят.
    const r = разборBrevo(ответ(200, планНаN(5)));
    expect(r.состояние).toBe("ok");
    expect(r.detail).toContain("5");
  });

  test("401 и 403 — ключ плох (именно это и значит «marked as inactive»)", () => {
    expect(разборBrevo(ответ(401, "")).состояние).toBe("ключ плох");
    expect(разборBrevo(ответ(403, "")).состояние).toBe("ключ плох");
  });

  test("200 без счётчика писем — «не знаю», а не «всё хорошо»", () => {
    const r = разборBrevo(ответ(200, { email: "x@y.z", plan: [{ type: "sms", credits: 10 }] }));
    expect(r.состояние).toBe("непонятно");
    expect(этоОк(r.состояние)).toBe(false);
  });

  test("тело не разобралось — «не знаю»", () => {
    expect(разборBrevo(ответ(200, "<html>")).состояние).toBe("непонятно");
  });

  test("500 — непонятно, и остаток не выдумывается", () => {
    const r = разборBrevo(ответ(500, "boom"));
    expect(r.состояние).toBe("непонятно");
    expect(r.detail).not.toMatch(/осталось/);
  });

  test("несколько почтовых записей складываются", () => {
    const r = разборBrevo(ответ(200, {
      plan: [
        { type: "subscription", creditsType: "sendLimit", credits: 100 },
        { type: "free", creditsType: "sendLimit", credits: 50 },
      ],
    }));
    expect(r.состояние).toBe("ok");
    expect(r.detail).toContain("150");
  });
});
