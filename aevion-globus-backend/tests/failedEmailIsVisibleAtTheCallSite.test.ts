import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";

/**
 * Неотправленное письмо обязано оставлять след ТАМ, ГДЕ ЕГО ЗАКАЗЫВАЛИ.
 *
 * `sendEmail` пишет о своём отказе, но не знает, ЧТО именно не доехало: вход в
 * дашборд, подтверждение заявки или уведомление о сделке. Места вызова знали
 * это и молчали — их `.catch` не мог сработать, потому что `sendEmail` не
 * бросает (доказано в `sendEmailNeverThrowsSoCatchIsDead.test.ts`).
 *
 * Здесь проверяется СЛЕДСТВИЕ починки, а не её форма: заявка сохраняется,
 * ответ остаётся успешным, и при этом в журнале появляется строка с меткой
 * места. Проверять «помощник вызван» было бы проверкой формы — она зелена и
 * на сломанной подстановке.
 */

process.env.NODE_ENV = "test";
process.env.AFFILIATE_FILE = join(
  mkdtempSync(join(tmpdir(), "aevion-aff-")),
  "affiliate.jsonl",
);
delete process.env.NOTIFY_EMAIL; // внутреннее уведомление не настроено — не мешает замеру

const { исход } = vi.hoisted(() => ({
  исход: {
    ok: false as boolean,
    error: "domain is not verified" as string | undefined,
    вызовов: 0,
  },
}));

vi.mock("../src/routes/provisioning", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/routes/provisioning")>();
  return {
    ...orig,
    sendEmail: async () => {
      исход.вызовов += 1;
      return { ok: исход.ok, mode: "real" as const, error: исход.error };
    },
  };
});

const { pricingRouter } = await import("../src/routes/pricing");

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/pricing", pricingRouter);
  return app;
}

const ЗАЯВКА = { name: "Иван Петров", email: "buyer@example.com" };

let ошибки: string[] = [];

beforeEach(() => {
  ошибки = [];
  исход.ok = false;
  исход.error = "domain is not verified";
  исход.вызовов = 0;
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    ошибки.push(a.map((x) => String(x)).join(" "));
  });
});

afterEach(() => vi.restoreAllMocks());

describe("отказ отправки виден в месте вызова", () => {
  test("письмо не ушло — в журнале строка с меткой, причиной и БЕЗ адреса целиком", async () => {
    // Заявка отправляется с уникального адреса: у маршрута свой ограничитель по IP.
    const r = await request(приложение())
      .post("/api/pricing/affiliate/apply")
      .set("X-Forwarded-For", "203.0.113.11")
      .send(ЗАЯВКА);

    // Операция НЕ падает из-за письма: заявка принята.
    expect(r.status).toBe(201);

    // Отправка идёт без ожидания ответа, поэтому строки ждём, а не спим фиксировано.
    await vi.waitFor(() => expect(ошибки.length).toBeGreaterThan(0), { timeout: 3000 });

    const строка = ошибки.find((s) => s.includes("письмо НЕ отправлено")) ?? "";
    expect(строка).toContain("apply/affiliate");
    expect(строка).toContain("domain is not verified");
    // Приватность: домен есть, полного адреса нет — то же решение, что в sendEmail.
    expect(строка).toContain("@example.com");
    expect(строка).not.toContain("buyer@example.com");
  });

  test("ни одна отправка не идёт мимо помощника", () => {
    // Поведением закрыт один маршрут из пяти: поднимать все пять ради одного
    // и того же следствия дороже, чем оно стоит. Остальные четыре держит это
    // утверждение — оно ловит возврат к мёртвому `.catch` в любом из них.
    const src = readFileSync(
      new URL("../src/routes/pricing.ts", import.meta.url),
      "utf8",
    ).split(String.fromCharCode(10));

    const прямые = src.filter((строка) => {
      if (!строка.includes("sendEmail(")) return false;
      const t = строка.trim();
      if (t.startsWith("*") || t.startsWith("//")) return false; // объяснение, а не вызов
      if (t.includes("await sendEmail(payload)")) return false;  // сам помощник
      return true;
    });

    expect(прямые).toEqual([]);
  });

  test("контроль: письмо ушло — об отказе не сообщается", async () => {
    исход.ok = true;
    исход.error = undefined;

    const r = await request(приложение())
      .post("/api/pricing/affiliate/apply")
      .set("X-Forwarded-For", "203.0.113.12")
      .send({ ...ЗАЯВКА, email: "other@example.com" });

    expect(r.status).toBe(201);

    // Ждём ПОЛОЖИТЕЛЬНОГО признака, а не времени: отправка точно состоялась.
    // Пауза на 300 мс делала вывод из тишины — под нагрузкой строка успела бы
    // появиться позже, и контроль сказал бы «чисто», не дождавшись. Это не
    // мигание, а ложное зелёное: тест проходит по неверной причине.
    await vi.waitFor(() => expect(исход.вызовов).toBeGreaterThan(0), { timeout: 3000 });

    expect(ошибки.filter((s) => s.includes("письмо НЕ отправлено"))).toHaveLength(0);
  });
});
