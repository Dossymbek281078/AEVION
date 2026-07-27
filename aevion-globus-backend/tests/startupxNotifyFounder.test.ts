import { describe, it, expect } from "vitest";
import { buildOfferEmail, offerTerms } from "../src/lib/startupx/notifyFounder";

const base = {
  founderEmail: "founder@example.com",
  listingId: 42,
  listingTitle: "Подбор обратного груза",
  ticketUsd: 30000,
  equityPct: 15,
  intent: "raise",
};

describe("письмо основателю об отклике", () => {
  it("в теме сразу видно условия — иначе письмо не отличить от рассылки", () => {
    const { subject } = buildOfferEmail(base);
    expect(subject).toContain("Подбор обратного груза");
    expect(subject).toContain("$30K");
    expect(subject).toContain("15%");
  });

  it("не несёт ни адреса инвестора, ни его сообщения", () => {
    // Почта основателя введена в форме и не подтверждена. Условия сделки —
    // публичная сторона, чужой контакт — нет.
    const { subject, text, html } = buildOfferEmail(base);
    for (const part of [subject, text, html]) {
      expect(part).not.toContain("investor@");
      expect(part.toLowerCase()).not.toContain("сообщение инвестора");
    }
  });

  it("не обещает ссылку на кабинет, которой у нас нет", () => {
    // Токен хранится только как SHA-256; письмо со ссылкой «войти» было бы
    // обещанием, которое нечем выполнить.
    const { text } = buildOfferEmail(base);
    expect(text).not.toMatch(/token=/);
    expect(text).toContain("сохранили при публикации");
  });

  it("неполные условия не превращаются в мусор", () => {
    expect(offerTerms({ ...base, ticketUsd: null, equityPct: null, intent: null }))
      .toBe("условия не указаны");
    expect(offerTerms({ ...base, equityPct: null, intent: null })).toBe("$30K");
    expect(offerTerms({ ...base, ticketUsd: null })).toBe("за 15% — вложение за долю");
  });

  it("суммы читаются как деньги, а не как сырое число", () => {
    expect(offerTerms({ ...base, ticketUsd: 2_500_000, equityPct: null, intent: null })).toBe("$2.5M");
    expect(offerTerms({ ...base, ticketUsd: 900, equityPct: null, intent: null })).toBe("$900");
    // Дробь в доле не должна тянуть хвост из плавающей точки.
    expect(offerTerms({ ...base, ticketUsd: null, intent: null, equityPct: 7.5 })).toBe("за 7.5%");
  });

  it("перевод строки из названия не доезжает до заголовка письма", () => {
    // Название пишет пользователь, а из него собирается тема. CRLF в теме —
    // это подстановка чужих полей письма («Bcc:» и что угодно ещё).
    const { subject } = buildOfferEmail({ ...base, listingTitle: "Заявка\r\nBcc: evil@test" });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Bcc: evil@test"); // остаётся текстом темы, а не полем
  });

  it("название заявки экранируется — оно приходит от пользователя", () => {
    const { html } = buildOfferEmail({ ...base, listingTitle: '<img src=x onerror="alert(1)">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
