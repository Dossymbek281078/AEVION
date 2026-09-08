import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Рассылка запуска обязана ОТКАЗАТЬСЯ, если ссылку отписки нечем подписать.
 *
 * Замер 08.09.2026: письмо, собранное без ключа, ставит вместо ссылки личный
 * адрес основателя — и уходит всем подписчикам, а отправка идёт как ни в чём
 * не бывало. Письмо можно послать через час; адрес из трёхсот ящиков не
 * вернёшь.
 *
 * Живой путь скрипта тестом не гоняется намеренно: он ОТПРАВЛЯЕТ. Поэтому
 * здесь две половины — поведение помощника и ПОРЯДОК в самом скрипте.
 */
const СКРИПТ = join(__dirname, "..", "scripts", "launch-announce-send.ts");

describe("рассылка не уходит без ссылки отписки", () => {
  const было = { a: process.env.WAITLIST_UNSUB_SECRET, b: process.env.AUTH_JWT_SECRET };
  beforeEach(() => {
    delete process.env.WAITLIST_UNSUB_SECRET;
    delete process.env.AUTH_JWT_SECRET;
  });
  afterEach(() => {
    if (было.a === undefined) delete process.env.WAITLIST_UNSUB_SECRET; else process.env.WAITLIST_UNSUB_SECRET = было.a;
    if (было.b === undefined) delete process.env.AUTH_JWT_SECRET; else process.env.AUTH_JWT_SECRET = было.b;
  });

  it("без ключа ссылка не строится, с ключом строится", async () => {
    const { unsubscribeUrl } = await import("../src/lib/waitlistUnsubToken");
    expect(unsubscribeUrl("probe@example.com"), "без ключа ссылка обязана быть null").toBeNull();
    process.env.WAITLIST_UNSUB_SECRET = "x".repeat(32);
    expect(unsubscribeUrl("probe@example.com"), "с ключом ссылка обязана появиться").toContain("unsubscribe?");
  });

  it("скрипт проверяет ссылку и останавливается кодом 2", () => {
    const s = readFileSync(СКРИПТ, "utf8");
    expect(s, "проба ссылки исчезла из скрипта").toContain('unsubscribeUrl("probe@example.com")');
    expect(s, "остановка при живой отправке исчезла").toMatch(/if \(ЖИВОЙ\) стоп\(2, беда\)/);
  });

  it("проверка стоит ДО первого письма, а не в цикле отправки", () => {
    const s = readFileSync(СКРИПТ, "utf8");
    const проба = s.indexOf('unsubscribeUrl("probe@example.com")');
    const цикл = s.indexOf("for (const email of заход.toSend)");
    expect(проба, "пробы нет").toBeGreaterThan(-1);
    expect(цикл, "цикла отправки нет").toBeGreaterThan(-1);
    expect(проба, "проверка оказалась ПОСЛЕ начала отправки — половина списка уйдёт неправильной").toBeLessThan(цикл);
  });

  it("сообщение называет переменную и каталог", () => {
    const s = readFileSync(СКРИПТ, "utf8");
    expect(s).toContain("WAITLIST_UNSUB_SECRET");
    expect(s, "не сказано, что каталог обязателен — следующий получит пустой ключ и не заметит")
      .toMatch(/Каталог обязателен/);
  });
});
