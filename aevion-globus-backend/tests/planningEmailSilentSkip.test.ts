import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Подтверждение записи в лист ожидания — ЕДИНСТВЕННОЕ, что человек получает,
 * оставив адрес. При ненастроенном SMTP оно уходило в никуда молча:
 *
 *   const transport = getTransport();
 *   if (!transport) return; // SMTP not configured — skip silently
 *
 * Список подписчиков при этом рос, и снаружи воронка выглядела работающей.
 * Замер 19.08.2026: тот же дефект нашёлся в двух отправителях из трёх; третий
 * (constitutionBrevo) вёл себя правильно — предупреждал и возвращал ошибку.
 *
 * Отправку не роняем: запись в лист ожидания важнее письма.
 */

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));

const SMTP = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

const CTX = {
  toEmail: "waiter@example.com",
  moduleId: "qskyway",
  moduleTitle: "QSkyway",
  modulePhase: "в разработке",
  moduleEta: "осень",
  moduleDescription: "описание",
};

describe("Письмо листа ожидания без настроек оставляет след", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    SMTP.forEach((v) => delete process.env[v]);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test("предупреждение есть и называет адрес и модуль", async () => {
    const { sendWaitlistConfirmation } = await import("../src/lib/planningEmail");
    sendWaitlistConfirmation(CTX);
    await new Promise((r) => setTimeout(r, 10));

    expect(warn).toHaveBeenCalled();
    const said = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(said).toContain("SMTP");
    expect(said).toContain("waiter@example.com");
    expect(said).toContain("qskyway");
  });

  test("вызов не бросает исключение", async () => {
    const { sendWaitlistConfirmation } = await import("../src/lib/planningEmail");
    expect(() => sendWaitlistConfirmation(CTX)).not.toThrow();
  });
});
