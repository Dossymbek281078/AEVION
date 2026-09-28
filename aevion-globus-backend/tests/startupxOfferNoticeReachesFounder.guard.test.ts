// Отклик инвестора обязан ДОЕХАТЬ до основателя, а не тихо исчезнуть.
//
// Замер 23.09.2026 по боевому проду (`/api/health/channels`): SMTP не настроен
// (`founderNotify.configured: false`), Resend настроен. Прежний код брал только
// SMTP и при его отсутствии делал `return` с комментарием «молча, это нормальный
// режим». То есть денежное действие — отклик инвестора на заявку — пропадало
// без единой строки в журнале.
//
// Проверяется СЛЕДСТВИЕ: письмо ушло вторым каналом. И отдельно — что полное
// отсутствие каналов названо вслух, а не проглочено.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { письма, каналЕсть, транспортЕсть } = vi.hoisted(() => ({
  письма: [] as Array<{ to: string; subject: string }>,
  каналЕсть: { value: true },
  транспортЕсть: { value: false },
}));

vi.mock("../src/lib/mailTransport", () => ({
  getMailTransport: () => (транспортЕсть.value ? { sendMail: async () => ({}) } : null),
  MAIL_FROM: "AEVION <noreply@aevion.app>",
  FRONTEND_BASE: "https://aevion.app",
}));

vi.mock("../src/lib/build/email", () => ({
  canSendEmail: () => каналЕсть.value,
  send: async (to: string, subject: string) => {
    письма.push({ to, subject });
    return true;
  },
}));

const NOTICE = {
  founderEmail: "founder@example.com",
  listingTitle: "Стартап про воду",
  ticketUsd: 50000,
  equityPct: 5,
  intent: "invest" as const,
};

describe("отклик инвестора доходит до основателя", () => {
  beforeEach(() => {
    письма.length = 0;
    каналЕсть.value = true;
    транспортЕсть.value = false;
  });

  it("без SMTP письмо уходит вторым каналом, а не пропадает", async () => {
    const { sendOfferNotice } = await import("../src/lib/startupx/notifyFounder");
    sendOfferNotice(NOTICE as never);
    await new Promise((r) => setTimeout(r, 0));
    expect(письма).toHaveLength(1);
    expect(письма[0].to).toBe("founder@example.com");
    expect(письма[0].subject.length).toBeGreaterThan(5);
  });

  it("когда каналов нет вовсе — это названо в журнале, а не проглочено", async () => {
    каналЕсть.value = false;
    const крик = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendOfferNotice } = await import("../src/lib/startupx/notifyFounder");
    sendOfferNotice(NOTICE as never);
    await new Promise((r) => setTimeout(r, 0));
    expect(письма).toHaveLength(0);
    expect(крик).toHaveBeenCalled();
    expect(String(крик.mock.calls[0][0])).toMatch(/НЕ доставлен/);
    крик.mockRestore();
  });
});
