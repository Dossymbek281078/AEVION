import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Состояние почты отвечает про ДОСТАВКУ, а не про настройку.
 *
 * 🔴 Находка соседнего окна 02.09.2026, проверена в файле. `emailSenderStatus()`
 * отдавал `configured` и `mode`, выведенные из ОДНОГО факта — задан ли ключ
 * поставщика. То есть «настроены ли мы отправлять», а не «доходит ли».
 *
 * Разница описана в самом `provisioning.ts`: домен отправителя нужно
 * подтвердить у поставщика, иначе КАЖДОЕ письмо отвергается. При этом
 * `configured` остаётся true, `mode` остаётся "real", и снаружи это
 * неотличимо от исправной отправки. Заплативший не получает доступ, а
 * состояние показывает зелёное.
 *
 * Доказательств поломки на проде нет — но покупок почти не было, значит и
 * отправок почти не было, и ноль отказов означает «не проверялось», а не
 * «работает». Поэтому вопрос закрыт прибором, а не наблюдением.
 */

const ключСохранён = process.env.RESEND_API_KEY;

beforeEach(() => {
  vi.resetModules();
  process.env.RESEND_API_KEY = "re_test_key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ключСохранён === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ключСохранён;
});

describe("состояние почты говорит про доставку", () => {
  test("до первой отправки честно сказано, что это НЕ подтверждение", async () => {
    const m = await import("../src/routes/provisioning");
    const s = m.emailSenderStatus();
    expect(s.lastSend, "исход взялся из ниоткуда").toBeNull();
    expect(
      s.lastSendMeaning,
      "пустой исход подан молча — `null` читают как «всё хорошо»",
    ).toContain("НЕ подтверждение");
  });

  test("отказ поставщика виден в состоянии, а не только в журнале", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "The aevion.app domain is not verified" }),
    }));
    const m = await import("../src/routes/provisioning");
    const r = await m.sendEmail({ to: "kto@to.example", subject: "тема", html: "<p/>", text: "т" } as never);

    expect(r.ok, "отказ поставщика выдан за успех").toBe(false);
    const s = m.emailSenderStatus();
    expect(s.lastSend?.ok, "состояние не заметило отказа").toBe(false);
    expect(s.lastSend?.httpStatus, "код ответа поставщика потерян").toBe(403);
    expect(s.lastSendMeaning).toContain("ОТКЛОНЕНА");
  });

  test("успешная отправка тоже видна — иначе сторож был бы односторонним", async () => {
    // Контроль: без него проверка выше проходила бы и в случае, когда
    // состояние ВСЕГДА докладывает отказ.
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_1" }),
    }));
    const m = await import("../src/routes/provisioning");
    await m.sendEmail({ to: "kto@to.example", subject: "тема", html: "<p/>", text: "т" } as never);
    const s = m.emailSenderStatus();
    expect(s.lastSend?.ok).toBe(true);
    expect(s.lastSendMeaning).toContain("прошла");
  });

  test("персональных данных в состоянии нет", async () => {
    // Публичная ручка. В сообщениях поставщика встречается адрес получателя,
    // поэтому ни адреса, ни текста ошибки здесь быть не должно.
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: "recipient kto@to.example rejected" }),
    }));
    const m = await import("../src/routes/provisioning");
    await m.sendEmail({ to: "kto@to.example", subject: "тема", html: "<p/>", text: "т" } as never);
    const текст = JSON.stringify(m.emailSenderStatus());
    expect(текст, "адрес получателя утёк в публичное состояние").not.toContain("kto@to.example");
    expect(текст, "текст ошибки поставщика утёк — в нём бывает адрес").not.toContain("rejected");
  });
});
