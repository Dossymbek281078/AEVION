import { describe, it, expect, vi, beforeEach } from "vitest";

const { sent, state } = vi.hoisted(() => ({
  sent: [] as Array<{ to: string; subject: string; html: string }>,
  state: { channel: true },
}));

vi.mock("../src/lib/mailTransport", () => ({
  getMailTransport: () => null,
  MAIL_FROM: "AEVION <noreply@aevion.app>",
  FRONTEND_BASE: "https://aevion.app",
}));

vi.mock("../src/lib/build/email", () => ({
  canSendEmail: () => state.channel,
  send: async (to: string, subject: string, html: string) => {
    sent.push({ to, subject, html });
    return true;
  },
}));

import {
  buildPublishedEmail,
  buildTeamNoticeEmail,
  detectLang,
  sendPublishNotices,
} from "../src/lib/startupx/notifyPublish";

const TOKEN = "tok_abc123SECRET";
const notice = {
  listingId: 7,
  listingTitle: "Подбор обратного груза",
  tier: "idea",
  sector: "logistics",
  geography: "KZ",
  intent: "raise",
  askUsd: 30000,
  equityPct: 15,
  founderEmail: "founder@example.com",
  contactMethod: "telegram",
  manageToken: TOKEN,
  lang: "ru" as const,
  isSmoke: false,
  teamEmail: "team@aevion.app",
};

beforeEach(() => {
  sent.length = 0;
  state.channel = true;
});

describe("письма при публикации заявки", () => {
  it("в письме основателю есть ссылка на кабинет с токеном и на страницу", () => {
    for (const lang of ["ru", "en"] as const) {
      const m = buildPublishedEmail({ listingId: 7, listingTitle: "X", manageToken: TOKEN, lang });
      expect(m.text).toContain(`https://aevion.app/startup-exchange/7/offers?token=${TOKEN}`);
      expect(m.html).toContain(`/startup-exchange/7/offers?token=${TOKEN}`);
      expect(m.text).toContain("https://aevion.app/startup-exchange/7\n");
    }
    expect(buildPublishedEmail({ listingId: 7, listingTitle: "X", manageToken: TOKEN, lang: "ru" }).text).toContain(
      "единственный ключ",
    );
  });

  it("в письме команде токена нет", () => {
    const m = buildTeamNoticeEmail(notice);
    for (const part of [m.subject, m.text, m.html]) {
      expect(part).not.toContain(TOKEN);
      expect(part).not.toContain("token=");
    }
    expect(m.text).toContain("founder@example.com");
    expect(m.text).toContain("telegram");
    expect(m.text).toContain("https://aevion.app/startup-exchange/7");
  });

  it("перевод строки в названии не попадает в тему", () => {
    const title = "Мило\r\nBcc: evil@example.com";
    expect(buildPublishedEmail({ listingId: 1, listingTitle: title, manageToken: TOKEN, lang: "ru" }).subject).not.toMatch(/[\r\n]/);
    expect(buildTeamNoticeEmail({ ...notice, listingTitle: title }).subject).not.toMatch(/[\r\n]/);
  });

  it("HTML экранируется", () => {
    const m = buildTeamNoticeEmail({ ...notice, listingTitle: "<script>x</script>" });
    expect(m.html).not.toContain("<script>");
  });

  it("язык по кириллице", () => {
    expect(detectLang("Привет", "x")).toBe("ru");
    expect(detectLang("Hello", "world")).toBe("en");
  });

  it("обычная заявка: письма уходят основателю и команде", () => {
    sendPublishNotices(notice);
    expect(sent.map((s) => s.to).sort()).toEqual(["founder@example.com", "team@aevion.app"]);
    const toTeam = sent.find((s) => s.to === "team@aevion.app")!;
    expect(toTeam.html).not.toContain(TOKEN);
    expect(sent.find((s) => s.to === "founder@example.com")!.html).toContain(TOKEN);
  });

  it("smoke-заголовок: команде не отправляется, основателю отправляется", () => {
    sendPublishNotices({ ...notice, listingTitle: "smoke-probe-1", isSmoke: true });
    expect(sent.map((s) => s.to)).toEqual(["founder@example.com"]);
  });

  it("пустой founderEmail: письма основателю нет", () => {
    sendPublishNotices({ ...notice, founderEmail: "" });
    sendPublishNotices({ ...notice, founderEmail: null });
    expect(sent.some((s) => s.to === "")).toBe(false);
    expect(sent.map((s) => s.to)).toEqual(["team@aevion.app", "team@aevion.app"]);
  });

  it("адрес с переводом строки не отправляется", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    sendPublishNotices({ ...notice, founderEmail: "a@b.c\r\nBcc: x@y.z" });
    expect(sent.map((s) => s.to)).toEqual(["team@aevion.app"]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("нет каналов: неуспех назван вслух, без полного адреса, и не бросает", () => {
    state.channel = false;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => sendPublishNotices(notice)).not.toThrow();
    expect(sent).toHaveLength(0);
    const out = err.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("@example.com");
    expect(out).not.toContain("founder@example.com");
    err.mockRestore();
  });

  it("NOTIFY_EMAIL пуст: предупреждение, письмо команде не уходит", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sendPublishNotices({ ...notice, teamEmail: "" });
    expect(sent.map((s) => s.to)).toEqual(["founder@example.com"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
