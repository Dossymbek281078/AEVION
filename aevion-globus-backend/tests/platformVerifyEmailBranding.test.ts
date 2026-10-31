import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAILER = readFileSync(join(HERE, "..", "src", "lib", "build", "email.ts"), "utf8");
const AUTH = readFileSync(join(HERE, "..", "src", "routes", "auth.ts"), "utf8");

/**
 * Письмо подтверждения адреса называется своим именем.
 *
 * Замер 28.08.2026 на ЖИВОМ ящике (зарегистрировался как обычный посетитель):
 * письмо пришло от «AEVION QPayNet» с темой «Подтвердите email — AEVION QBuild».
 * Два чужих модуля в одном письме человеку, который завёл аккаунт играть в
 * шахматы. Почтовик переиспользуется у модуля найма — это нормально, но имя в
 * письме должно быть платформы.
 *
 * Проверяем ИСХОДНИК, а не отправку: настоящая отправка требует ключей и живого
 * ящика, а имя в письме — свойство кода, и оно не должно вернуться назад тихо.
 */
describe("подтверждение адреса представляется платформой", () => {
  test("auth передаёт своё имя, а не имя модуля найма", () => {
    const at = AUTH.indexOf("sendVerificationEmail({");
    expect(at, "ручка больше не зовёт отправку письма — проверь тест").toBeGreaterThan(-1);
    expect(AUTH.slice(at, at + 600)).toContain('brand: "AEVION"');
  });

  test("тема письма собирается из имени, а не зашита", () => {
    // 31.10.2026 письмо стало трёхъязычным: тема = текст языка + имя, а не зашитая строка.
    expect(MAILER).toContain("`${T.subject} — ${brand}`");
    expect(MAILER).toContain('subject: "Подтвердите email"');
    expect(MAILER).not.toContain('"Подтвердите email — AEVION QBuild"');
  });

  test("шапка и подпись письма тоже берут имя", () => {
    // Тема — не всё письмо: в теле логотип и подпись стояли отдельно, и
    // починка только темы оставила бы чужое имя на видном месте.
    expect(MAILER).toContain('<div class="logo">${brand}</div>');
    expect(MAILER).toContain("уведомление от ${b}");
    expect(MAILER).toContain("LAYOUT_FOOT[lang](brand)");
  });

  test("у почтовика модуля имя по умолчанию НЕ изменилось", () => {
    // Он обслуживает QBuild, и его собственные письма должны остаться прежними.
    expect(MAILER).toContain('function layout(body: string, brand = "AEVION QBuild"');
    expect(MAILER).toContain('const brand = opts.brand || "AEVION QBuild"');
    // …а платформенный сброс пароля называет платформу ЯВНО — иначе возврат умолчания модулю
    // вернул бы «AEVION QBuild» в тело письма о пароле (волна 79, 12.10.2026).
    const сброс = MAILER.slice(MAILER.indexOf("export async function sendPasswordResetEmail"));
    expect(сброс.slice(0, 2000)).toContain("`, БРЕНД_ПЛАТФОРМЫ),");
  });
  test("🔴 письма модуля называют одно имя и в теле, и у отправителя — семь писем, бренд модуля", () => {
    // 13.10.2026: отправитель по умолчанию стал «AEVION», тело — «AEVION QBuild»: два имени в одном
    // письме читаются как подделка. Семь писем найма передают БРЕНД_МОДУЛЯ и layout(), и send().
    expect(MAILER).toContain('export const БРЕНД_МОДУЛЯ = "AEVION QBuild"');
    const вТеле = MAILER.split("`, БРЕНД_МОДУЛЯ),").length - 1;
    // Перевод строки — числом: литерал со слэшем уже однажды съелся на границе вызова (правило 2е).
    const ПС = String.fromCharCode(10);
    const текст = MAILER.split(String.fromCharCode(13)).join("");
    const уОтправителя = текст.split("    БРЕНД_МОДУЛЯ," + ПС + "  );").length - 1;
    expect(вТеле, "бренд модуля в теле").toBe(7);
    expect(уОтправителя, "бренд модуля у отправителя — столько же, сколько в теле").toBe(7);
    // платформенные письма отправителя по умолчанию не меняют
    expect(текст.split("БРЕНД_ПЛАТФОРМЫ," + ПС + "  );").length - 1).toBe(0);
  });
});
