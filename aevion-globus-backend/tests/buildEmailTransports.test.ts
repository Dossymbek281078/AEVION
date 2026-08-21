import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * У модуля почты ДВА транспорта, и это не запас «на всякий случай».
 *
 * В `routes/build/` пять мест шлют письма прямым вызовом `api.resend.com`
 * (оповещения о вакансиях, отклики, подтверждение анкеты, выдача доступа).
 * Значит боевой сервер может быть настроен ТОЛЬКО на Resend. Модуль, умеющий
 * один SMTP, отвечал бы на таком сервере «отправка не настроена» — неправда,
 * потому что соседний код в ту же секунду успешно шлёт.
 *
 * Ошибку нашёл на собственной починке: `canSendEmail()` сперва спрашивала
 * только SMTP, и регистрация вернула бы 503 при рабочей почте.
 */

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport: (...a: unknown[]) => createTransport(...a) } }));

// eslint-disable-next-line import/first
import { canSendEmail, sendVerificationEmail } from "../src/lib/build/email";

const VARS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_PORT", "RESEND_API_KEY"];
const saved: Record<string, string | undefined> = {};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  VARS.forEach((v) => { saved[v] = process.env[v]; delete process.env[v]; });
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
  sendMail.mockResolvedValue({ messageId: "m1" });
});
afterEach(() => {
  VARS.forEach((v) => { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; });
  vi.unstubAllGlobals();
});

const smtpOn = () => {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "u@example.com";
  process.env.SMTP_PASS = "secret";
};

describe("canSendEmail честно отвечает про ОБА транспорта", () => {
  test("ничего не настроено — false", () => {
    expect(canSendEmail()).toBe(false);
  });
  test("только SMTP — true", () => {
    smtpOn();
    expect(canSendEmail()).toBe(true);
  });
  test("только Resend — true (тот случай, на котором я сам ошибся)", () => {
    process.env.RESEND_API_KEY = "re_key";
    expect(canSendEmail()).toBe(true);
  });
  test("пробел вместо ключа настройкой не считается", () => {
    process.env.RESEND_API_KEY = "   ";
    expect(canSendEmail()).toBe(false);
  });
});

describe("Отправка выбирает транспорт и говорит правду о результате", () => {
  test("ничего не настроено — письмо НЕ ушло, и функция это возвращает", async () => {
    expect(await sendVerificationEmail({ to: "a@b.c", name: "A", token: "t1" })).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("есть SMTP — идём в SMTP, HTTP не трогаем", async () => {
    smtpOn();
    expect(await sendVerificationEmail({ to: "a@b.c", name: "A", token: "t1" })).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("только Resend — уходит по HTTP, с ключом и на верный адрес", async () => {
    process.env.RESEND_API_KEY = "re_key";
    expect(await sendVerificationEmail({ to: "a@b.c", name: "A", token: "tok-42" })).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.headers.Authorization).toBe("Bearer re_key");
    const body = JSON.parse(opts.body) as { to: string; html: string };
    expect(body.to).toBe("a@b.c");
    // Токен обязан попасть в ссылку — иначе письмо бесполезно.
    expect(body.html).toContain("tok-42");
  });

  test("Resend отказал — возвращаем false, а не тихое «ок»", async () => {
    process.env.RESEND_API_KEY = "re_key";
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
    expect(await sendVerificationEmail({ to: "a@b.c", name: "A", token: "t" })).toBe(false);
  });

  test("SMTP сорвался, а Resend настроен — письмо всё-таки уходит", async () => {
    smtpOn();
    process.env.RESEND_API_KEY = "re_key";
    sendMail.mockRejectedValue(new Error("connection refused"));
    expect(await sendVerificationEmail({ to: "a@b.c", name: "A", token: "t" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("SMTP сорвался, запасного нет — честный false", async () => {
    smtpOn();
    sendMail.mockRejectedValue(new Error("connection refused"));
    expect(await sendVerificationEmail({ to: "a@b.c", name: "A", token: "t" })).toBe(false);
  });
});
