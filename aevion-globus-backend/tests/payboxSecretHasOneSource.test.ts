import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Секрет PayBox читается ОДНИМ резолвером, а не разными именами в разных файлах.
 *
 * Замер 02.09.2026: касса и страница состояния спрашивали PAYBOX_SECRET, а
 * routes/payments.ts — PAYBOX_SECRET_KEY, и подписывает платёжный запрос именно
 * он. Задай владелец одно имя из двух — половина платежей ушла бы без подписи,
 * а страница состояния при этом рапортовала бы «настроено».
 *
 * Это худший вид расхождения: обе половины исправны по отдельности, ошибка
 * живёт в ОТНОШЕНИИ между ними и вылезает только на живых деньгах.
 */

const ИМЕНА = ["PAYBOX_SECRET", "PAYBOX_SECRET_KEY", "PAYBOX_MERCHANT_ID", "PAYBOX_MERCHANT"];

describe("секрет PayBox имеет один источник", () => {
  const было: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ИМЕНА) { было[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ИМЕНА) {
      if (было[k] === undefined) delete process.env[k];
      else process.env[k] = было[k];
    }
  });

  it("секрет виден под ОБОИМИ именами", async () => {
    const m = await import("../src/lib/payment/payboxProvider");

    process.env.PAYBOX_SECRET = "aaa";
    expect(m.payboxSecret(), "не увидел PAYBOX_SECRET").toBe("aaa");

    delete process.env.PAYBOX_SECRET;
    process.env.PAYBOX_SECRET_KEY = "bbb";
    expect(m.payboxSecret(), "не увидел PAYBOX_SECRET_KEY").toBe("bbb");
  });

  it("без секрета касса НЕ считается настроенной — контроль", async () => {
    const m = await import("../src/lib/payment/payboxProvider");
    process.env.PAYBOX_MERCHANT_ID = "123";
    expect(m.isPayboxConfigured(), "настроено без секрета").toBe(false);
    process.env.PAYBOX_SECRET_KEY = "bbb";
    expect(m.isPayboxConfigured(), "не настроено при заданном секрете").toBe(true);
  });

  it("пробелы вместо значения не считаются заданным секретом", async () => {
    const m = await import("../src/lib/payment/payboxProvider");
    process.env.PAYBOX_MERCHANT_ID = "123";
    process.env.PAYBOX_SECRET = "   ";
    expect(m.payboxSecret()).toBe("");
    expect(m.isPayboxConfigured(), "пустая строка принята за секрет").toBe(false);
  });

  it("подписывающий и рапортующий файлы зовут общий резолвер, а не своё имя", () => {
    const читатели = [
      "src/routes/payments.ts",       // подписывает платёжный запрос
      "src/routes/channelsHealth.ts", // сообщает «настроено ли»
    ];
    for (const rel of читатели) {
      const src = readFileSync(join(__dirname, "..", rel), "utf8");
      const строки = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
      const своиИмена = строки.filter((l) => /process\.env\.PAYBOX_SECRET/.test(l));
      expect(своиИмена, `${rel} читает переменную сам, мимо общего резолвера`).toEqual([]);
      expect(src, `${rel} не импортирует общий резолвер`).toContain("payboxSecret");
    }
  });
});
