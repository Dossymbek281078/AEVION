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
    expect(MAILER).toContain("`Подтвердите email — ${brand}`");
    expect(MAILER).not.toContain('"Подтвердите email — AEVION QBuild"');
  });

  test("шапка и подпись письма тоже берут имя", () => {
    // Тема — не всё письмо: в теле логотип и подпись стояли отдельно, и
    // починка только темы оставила бы чужое имя на видном месте.
    expect(MAILER).toContain('<div class="logo">${brand}</div>');
    expect(MAILER).toContain("уведомление от ${brand}");
  });

  test("у почтовика модуля имя по умолчанию НЕ изменилось", () => {
    // Он обслуживает QBuild, и его собственные письма должны остаться прежними.
    expect(MAILER).toContain('function layout(body: string, brand = "AEVION QBuild")');
    expect(MAILER).toContain('const brand = opts.brand || "AEVION QBuild"');
  });
});
