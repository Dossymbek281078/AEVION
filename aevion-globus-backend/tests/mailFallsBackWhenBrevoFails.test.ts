import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * Денежные письма переживают отказ Brevo.
 *
 * Повод: 05.10.2026 Brevo прислал «your API keys have been marked as
 * inactive». Через него шли подтверждение листа ожидания (сбор адресов со
 * ВСЕХ витрин) и письма по заявкам агентства — и у них НЕ БЫЛО запасного
 * канала: `sendBrevoEmail` возвращал false, и поток умирал молча.
 *
 * Тест гоняет настоящие `sendWaitlistConfirm` / `sendAgencyLeadNotice` /
 * `sendAgencyLeadReceipt`; подменены только сеть (ответ Brevo) и запасной
 * отправитель.
 */

process.env.BREVO_API_KEY = "test-key-not-real";
process.env.BREVO_SENDER_EMAIL = "noreply@aevion.app";

const { запасной } = vi.hoisted(() => ({ запасной: vi.fn() }));
vi.mock("../src/lib/build/email", () => ({
  send: запасной,
  canSendEmail: () => true,
  sendVerificationEmail: vi.fn(),
}));

const {
  sendWaitlistConfirm,
  sendAgencyLeadNotice,
  sendAgencyLeadReceipt,
} = await import("../src/lib/constitutionBrevo");

const настоящийFetch = global.fetch;
afterAll(() => { global.fetch = настоящийFetch; });

/** Ответ Brevo на все исходящие запросы в этом тесте. */
function BrevoОтвечает(status: number, body: unknown) {
  global.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("Brevo отказал — письмо уходит запасным каналом", () => {
  beforeEach(() => { запасной.mockReset(); запасной.mockResolvedValue(true); });

  test("лист ожидания: Brevo 401 → письмо всё равно отправлено", async () => {
    BrevoОтвечает(401, { message: "Key not found" });
    const ушло = await sendWaitlistConfirm("human@example.com", "landing");
    expect(ушло, "подтверждение подписки потеряно при живом запасном канале").toBe(true);
    expect(запасной).toHaveBeenCalledTimes(1);
    expect(запасной.mock.calls[0][0]).toBe("human@example.com");
  });

  test("заявка агентства: Brevo 401 → уведомление всё равно отправлено", async () => {
    BrevoОтвечает(401, { message: "Key not found" });
    const ушло = await sendAgencyLeadNotice({ contact: "buyer@example.com", message: "хочу купить" });
    expect(ушло).toBe(true);
    expect(запасной).toHaveBeenCalledTimes(1);
  });

  test("расписка заявителю: Brevo 401 → письмо всё равно отправлено", async () => {
    BrevoОтвечает(401, { message: "Key not found" });
    const ушло = await sendAgencyLeadReceipt({ contact: "buyer@example.com", message: "хочу купить" });
    expect(ушло).toBe(true);
    expect(запасной).toHaveBeenCalledTimes(1);
  });

  test("оба канала легли — честное false, а не тихий успех", async () => {
    BrevoОтвечает(401, { message: "Key not found" });
    запасной.mockResolvedValue(false);
    expect(await sendWaitlistConfirm("human@example.com")).toBe(false);
  });

  test("Brevo работает — запасной канал НЕ зовём (иначе письмо уйдёт дважды)", async () => {
    BrevoОтвечает(201, { messageId: "<ok@brevo>" });
    const ушло = await sendWaitlistConfirm("human@example.com");
    expect(ушло).toBe(true);
    expect(запасной, "запасной канал вызван при исправном Brevo — человек получит два письма").not.toHaveBeenCalled();
  });

  test("отказ Brevo попадает в журнал с причиной, даже когда запас спас письмо", async () => {
    // Молчаливый успех поверх отказа — то, из-за чего поломку замечают через
    // неделю. Проверяем, что в журнале названы и поток, и причина.
    const записи: string[] = [];
    const былОшибки = console.error, былПредупр = console.warn;
    console.error = (...a: unknown[]) => { записи.push(a.join(" ")); };
    console.warn = (...a: unknown[]) => { записи.push(a.join(" ")); };
    try {
      BrevoОтвечает(401, { message: "Key not found" });
      await sendWaitlistConfirm("human@example.com");
    } finally {
      console.error = былОшибки; console.warn = былПредупр;
    }
    const всё = записи.join(" | ");
    expect(всё, "в журнале нет имени потока").toContain("лист-ожидания");
    expect(всё, "в журнале нет причины отказа").toMatch(/401|Key not found/);
    expect(всё, "не сказано, что письмо ушло запасным каналом").toMatch(/ЗАПАСНЫМ|запасн/i);
  });
});
