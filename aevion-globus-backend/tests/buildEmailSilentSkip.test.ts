import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Отправитель при ненастроенном SMTP раньше делал `return` МОЛЧА:
 *
 *   const transport = getTransport();
 *   if (!transport) return; // SMTP not configured — skip silently
 *
 * Это худший вид отказа — ненастроенная почта выглядела как успешная отправка.
 * Ни в журнале, ни в Sentry, ни в ответе ручки не оставалось ничего, и «письма
 * не приходят» невозможно было отличить от «письма не отправлялись».
 *
 * Замер 19.08.2026: из девяти писем модуля пять не вызываются вовсе, а
 * вызываемые при пустых настройках уходили в никуда.
 *
 * Теперь остаётся предупреждение в журнале. Отправку по-прежнему НЕ роняем:
 * письмо не должно валить операцию, ради которой его шлют.
 */

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));

const SMTP = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

describe("Отправитель без настроек оставляет след", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    SMTP.forEach((v) => delete process.env[v]);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test("SMTP не настроен — письмо не уходит, но предупреждение есть", async () => {
    const { sendVerificationEmail } = await import("../src/lib/build/email");
    sendVerificationEmail({ to: "user@example.com", name: "Тест", token: "t1" });
    await new Promise((r) => setTimeout(r, 10));

    expect(warn).toHaveBeenCalled();
    const said = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(said).toContain("SMTP");
    // В следе должно быть видно, КОМУ и ЧТО не ушло — иначе он бесполезен.
    expect(said).toContain("user@example.com");
  });

  test("отправка не роняет вызвавшую операцию", async () => {
    const { sendPasswordResetEmail } = await import("../src/lib/build/email");
    // Функция синхронная и не должна бросать даже без настроек.
    expect(() =>
      sendPasswordResetEmail({ to: "u@example.com", name: "Тест", token: "t2" }),
    ).not.toThrow();
  });
});
