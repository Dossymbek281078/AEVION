import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { store, type ApiLink } from "../../payments/v1/_lib";
import { POST } from "../[id]/route";

/**
 * Поле `email_queued` равно настоящему исходу отправки чека.
 *
 * ЗАМЕР 01.09.2026. Тест написан ПОСЛЕ того, как выяснилось, что сам дефект
 * (безусловное `true` рядом с выброшенным через `void` результатом) уже починен
 * 29.08 соседним окном — и починен строже, чем предлагал я: отправка ожидается,
 * и поле выводится из её настоящего исхода. Свою правку снял, тест оставил:
 * у починки не было ни одной проверки, а значит её мог молча отменить любой
 * возврат к «не ждать и обещать».
 *
 * Читает это поле тот, кто уже заплатил (и его система). Отказ, который
 * выглядит успехом, — самый дорогой сорт: про сломанное узнают, про «успешно
 * поставлено в очередь» не узнаёт никто, и чек просто не приходит.
 *
 * Проверяется ПОВЕДЕНИЕМ ручки, а не наличием строк в исходнике: признак «в
 * коде есть проверка» переживает и такую правку, после которой проверка ни на
 * что не влияет.
 */

const KEY = "RESEND_API_KEY";
let warned: string[] = [];
let fetchCalls = 0;

function makeLink(id: string): ApiLink {
  return {
    id,
    amount: 4900,
    currency: "USD",
    title: "AEVION Pro",
    description: "",
    settlement: "bank",
    expires_in_days: null,
    status: "active",
    created: 1,
    url: "https://aevion.app/r/" + id,
    paid_at: null,
  };
}

async function pay(id: string, email: string | undefined) {
  store.links.set(id, makeLink(id));
  const req = new Request("https://aevion.app/api/pay/" + id, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(email === undefined ? {} : { payer_email: email }),
  });
  const res = await POST(req as never, { params: Promise.resolve({ id }) });
  return (await res.json()) as { email_queued?: boolean };
}

beforeEach(() => {
  warned = [];
  fetchCalls = 0;
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
    warned.push(a.map(String).join(" "));
  });
  vi.stubGlobal("fetch", async () => {
    fetchCalls += 1;
    return new Response("{}", { status: 200 });
  });
  delete process.env[KEY];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env[KEY];
});

describe("чек обещается только когда он уйдёт", () => {
  test("без ключа провайдера чек НЕ обещан", async () => {
    const body = await pay("lnk_no_key", "buyer@example.com");
    expect(body.email_queued, "обещали чек, не имея чем его отправить").toBe(false);
    expect(fetchCalls, "без ключа не должно быть обращения к провайдеру").toBe(0);
    expect(warned.join(" "), "отказ не попал в журнал — снаружи он неотличим от успеха").toContain("no_key");
  });

  test("при неверном адресе чек НЕ обещан", async () => {
    process.env[KEY] = "re_test";
    const body = await pay("lnk_bad_mail", "не-адрес");
    expect(body.email_queued).toBe(false);
    expect(fetchCalls).toBe(0);
    expect(warned.join(" ")).toContain("invalid_email");
  });

  test("с ключом и верным адресом чек обещан и уходит", async () => {
    process.env[KEY] = "re_test";
    const body = await pay("lnk_ok", "buyer@example.com");
    expect(body.email_queued).toBe(true);
    expect(fetchCalls, "чек обещан, но провайдера никто не звал").toBe(1);
  });

  test("оплата без адреса плательщика чек не обещает", async () => {
    process.env[KEY] = "re_test";
    const body = await pay("lnk_no_mail", undefined);
    expect(body.email_queued).toBe(false);
  });

  test("отказ провайдера виден в поле и в журнале, БЕЗ полного адреса", async () => {
    process.env[KEY] = "re_test";
    vi.stubGlobal("fetch", async () => {
      fetchCalls += 1;
      return new Response("upstream down", { status: 500 });
    });
    const body = await pay("lnk_fail", "buyer@example.com");
    // Отправка ожидается, поэтому отказ провайдера виден СРАЗУ и в поле.
    expect(body.email_queued, "отказ провайдера выдан за успешную отправку").toBe(false);
    const log = warned.join(" ");
    expect(log, "отказ провайдера нигде не виден").toContain("500");
    expect(log, "в журнале нет ссылки, по которой отказ можно найти").toContain("lnk_fail");
    expect(log, "полный адрес — персональные данные, ему в журнале не место").not.toContain("buyer@");
  });
});
