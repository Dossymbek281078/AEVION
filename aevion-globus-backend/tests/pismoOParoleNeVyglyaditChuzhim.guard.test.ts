import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 ПИСЬМО О ПАРОЛЕ НЕ ВЫГЛЯДИТ ЧУЖИМ.
 *
 * Замер 12.10.2026 (окно «Почта», живой прод): письмо сброса приходило от
 * «AEVION QPayNet <noreply@aevion.app>» с темой «Сброс пароля — AEVION QBuild».
 * QPayNet — платёжный модуль, QBuild — модуль найма; человек не открывал ни
 * того, ни другого, он заводил аккаунт AEVION. Для письма о ПАРОЛЕ чужое имя в
 * отправителе читается как фишинг: письмо доходит за 3 секунды и всё равно не
 * работает, потому что осторожный человек его не откроет.
 *
 * Имя приезжало из переменной `SMTP_FROM`. Переменную сторожем не охранить,
 * поэтому имя теперь задаёт КОД, а настройке оставлен только адрес.
 */
const было: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ["SMTP_FROM", "RESEND_API_KEY", "SMTP_HOST"]) было[k] = process.env[k];
  vi.resetModules();
});
afterEach(() => {
  for (const [k, v] of Object.entries(было)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

async function модуль() {
  vi.resetModules();
  return await import("../src/lib/build/email");
}

describe("отправитель письма", () => {
  it("🔴 имя задаёт код, а адрес — настройка", async () => {
    process.env.SMTP_FROM = "AEVION QPayNet <noreply@aevion.app>";
    const { otpravitel, БРЕНД_ПЛАТФОРМЫ } = await модуль();
    // Ровно тот случай, что был на проде: имя модуля НЕ должно пережить правку.
    expect(otpravitel()).toBe("AEVION <noreply@aevion.app>");
    expect(otpravitel()).not.toContain("QPayNet");
    expect(БРЕНД_ПЛАТФОРМЫ).toBe("AEVION");
  });

  it("адрес разбирается из всех видов настройки — знаменатель 5 из 5", async () => {
    const { adresOtpravitelya } = await модуль();
    const случаи: Array<[string | undefined, string]> = [
      ["AEVION QPayNet <noreply@aevion.app>", "noreply@aevion.app"],
      ["noreply@aevion.app", "noreply@aevion.app"],
      ["  Имя С Пробелами  < mail@aevion.app >  ", "mail@aevion.app"],
      // Негодная настройка — наш адрес, а не мусор в поле отправителя.
      ["совсем не адрес", "noreply@aevion.app"],
      [undefined, "noreply@aevion.app"],
    ];
    for (const [дано, ждём] of случаи) {
      if (дано === undefined) delete process.env.SMTP_FROM; else process.env.SMTP_FROM = дано;
      expect(adresOtpravitelya(), `разбор не тот для: ${String(дано)}`).toBe(ждём);
    }
    expect(случаи.length, "знаменатель: видов настройки проверено").toBe(5);
  });

  it("имя модуля сохраняется там, где оно ЧЕСТНО", async () => {
    // Контроль в обратную сторону: правка не обязана стирать имена модулей —
    // письмо из модуля найма вправе называться его именем. Запрещено другое:
    // чужое имя в письме о пароле аккаунта платформы.
    process.env.SMTP_FROM = "что угодно <noreply@aevion.app>";
    const { otpravitel } = await модуль();
    expect(otpravitel("AEVION QBuild")).toBe("AEVION QBuild <noreply@aevion.app>");
    // Пустое имя не даёт отправителя без имени.
    expect(otpravitel("   ")).toBe("AEVION <noreply@aevion.app>");
  });
});

describe("знаменатель: кто задаёт видимое имя отправителя", () => {
  it("🔴 ни одно письмо ПЛАТФОРМЫ не берёт имя из настройки", () => {
    /*
     * Знаменатель назван явно: отправителей в коде шесть. Пять из них — письма
     * модуля найма QBuild (отклики, вакансии, оповещения, проверка профиля), и
     * имя «QBuild» там ЧЕСТНО: человек в этот момент пользуется QBuild. Шестой
     * — общий почтовик платформы, и он-то и показывал «QPayNet».
     *
     * Проверяем именно свойство «имя не из переменной»: пока оно брало
     * process.env.SMTP_FROM, его нельзя было ни охранить, ни предсказать.
     */
    const файлы = ["src/lib/build/email.ts", "src/lib/planningEmail.ts"];
    let всегоСтрок = 0;
    for (const ф of файлы) {
      const t = readFileSync(join(process.cwd(), ф), "utf8");
      const строки = t.split("\n").filter((с) => {
        const обрез = с.trim();
        if (обрез.startsWith("//") || обрез.startsWith("*") || обрез.startsWith("/*")) return false;
        return с.includes("SMTP_FROM");
      });
      всегоСтрок += строки.length;
      // Единственное разрешённое использование — вынуть АДРЕС, не имя.
      for (const с of строки) {
        expect(с, ф + ": имя отправителя снова из настройки — " + с.trim()).toMatch(/сырое|adresOtpravitelya/);
      }
    }
    expect(файлы.length, "знаменатель: почтовиков платформы проверено").toBe(2);
    // Контроль прибора: строки с переменной вообще нашлись. Ноль здесь означал
    // бы «я ничего не проверил», и проверка была бы зелёной впустую.
    expect(всегоСтрок, "ни одной строки с SMTP_FROM — прибор слеп").toBeGreaterThan(0);
  });
});

describe("письмо сброса пароля уходит от платформы", () => {
  it("🔴 тема и отправитель — AEVION, без имён модулей", async () => {
    process.env.SMTP_FROM = "AEVION QPayNet <noreply@aevion.app>";
    process.env.RESEND_API_KEY = "re_test_kluch";
    delete process.env.SMTP_HOST;
    const отправленное: Array<Record<string, string>> = [];
    const настоящий = globalThis.fetch;
    globalThis.fetch = (async (u: unknown, o?: { body?: string }) => {
      if (String(u).includes("api.resend.com")) отправленное.push(JSON.parse(String(o?.body)));
      return { ok: true, status: 200, json: async () => ({ id: "x" }), text: async () => "{}" } as unknown as Response;
    }) as unknown as typeof fetch;
    try {
      const { sendPasswordResetEmail } = await модуль();
      const ок = await sendPasswordResetEmail({ to: "chelovek@example.com", name: "Человек", token: "tok-123" });
      expect(ок, "письмо не ушло — проверять нечего").toBe(true);
      expect(отправленное.length, "запроса к поставщику не было").toBe(1);
      const п = отправленное[0];
      expect(п.from, `отправитель: ${п.from}`).toBe("AEVION <noreply@aevion.app>");
      expect(п.subject, `тема: ${п.subject}`).toBe("Сброс пароля — AEVION");
      for (const чужое of ["QPayNet", "QBuild", "QRight", "QSign"]) {
        expect(п.from, `имя модуля в отправителе: ${чужое}`).not.toContain(чужое);
        expect(п.subject, `имя модуля в теме: ${чужое}`).not.toContain(чужое);
      }
      // Контроль прибора: тело письма мы ВИДИМ, значит проверка смотрит на
      // настоящий запрос, а не на пустышку.
      expect(п.html, "тела письма нет").toContain("Сбросить пароль");
      expect(п.html, "ссылка не наша").toContain("/build/reset-password?token=tok-123");
    } finally {
      globalThis.fetch = настоящий;
    }
  });
});
