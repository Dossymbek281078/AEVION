import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Оплата прошла, письмо с доступом не ушло — это обязано быть видно.
 *
 * `provisionSubscription` возвращает признак `emailSent`. Замер 01.09.2026:
 * его не читает ни одна из четырёх касс. Замер 04.09.2026 повторил результат —
 * читателей по-прежнему ноль на пяти вызывающих. Значит человек платил, доступ
 * записывался, письмо не уходило, вебхук отвечал кассе успехом — и найти этого
 * покупателя было нельзя: сам отправщик о своём отказе пишет, но не знает, что
 * за письмом стоит оплата.
 *
 * Тест держит СЛЕДСТВИЕ: в следе есть связка «оплачено + не отправлено» с
 * идентификатором подписки, а не просто факт неудачной отправки. И держит
 * границу: ответ операции остаётся успешным, доступ выдан.
 */

const { события } = vi.hoisted(() => ({ события: [] as Array<Record<string, unknown>> }));

vi.mock("../src/lib/sentry/platform", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/lib/sentry/platform")>();
  return {
    ...orig,
    makeServiceCapture: () => (err: unknown, ctx?: Record<string, unknown>) => {
      события.push({ сообщение: String(err), ...(ctx ?? {}) });
    },
  };
});

const ВРЕМЕННЫЙ = mkdtempSync(join(tmpdir(), "aevion-subs-"));
const KEY = "re_test_secret_value_do_not_leak_000";

async function загрузить() {
  process.env.SUBSCRIPTIONS_FILE = join(ВРЕМЕННЫЙ, "subscriptions.jsonl");
  process.env.RESEND_API_KEY = KEY;
  vi.resetModules(); // модуль читает env на верхнем уровне
  return import("../src/routes/provisioning");
}

const ПОКУПКА = {
  email: "buyer@example.com",
  tierId: "medium" as const,
  amountUsd: 59,
};

const исходныйFetch = globalThis.fetch;
let ошибки: string[] = [];

beforeEach(() => {
  ошибки = [];
  события.length = 0;
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    ошибки.push(a.map((x) => String(x)).join(" "));
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = исходныйFetch;
  // Возвращаем окружение: проверка режима заглушки СТИРАЕТ ключ, и без этой
  // строки любой следующий тест зависел бы от порядка. Порядок — не то, на что
  // стоит опираться: он меняется от параллельности и от фильтра запуска.
  process.env.RESEND_API_KEY = KEY;
  vi.restoreAllMocks();
});

describe("оплаченная покупка без письма оставляет след", () => {
  test("Resend отверг письмо — в следе покупка, тариф и причина", async () => {
    const { provisionSubscription } = await загрузить();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "domain is not verified" }),
    })) as unknown as typeof fetch;

    const r = await provisionSubscription(ПОКУПКА);

    // Граница: доступ выдан, операция успешна — письмо её не роняет.
    expect(r.subscription.id).toBeTruthy();
    expect(r.emailSent).toBe(false);

    const строка = ошибки.find((s) => s.includes("ОПЛАЧЕНО")) ?? "";
    expect(строка).toContain(r.subscription.id);   // по нему покупателя и найдут
    expect(строка).toContain("medium");
    expect(строка).toContain("domain is not verified");
    // Приватность: домен есть, адрес целиком нет.
    expect(строка).toContain("@example.com");
    expect(строка).not.toContain("buyer@example.com");
  });

  test("событие для Sentry несёт ПОКУПКУ, а не только письмо", async () => {
    const { provisionSubscription } = await загрузить();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "domain is not verified" }),
    })) as unknown as typeof fetch;

    const r = await provisionSubscription(ПОКУПКА);

    // Событий может быть два: одно заводит сам отправщик о своём отказе.
    // Нас интересует то, по которому можно найти ЧЕЛОВЕКА.
    const сОплатой = события.filter((e) => e.subscriptionId === r.subscription.id);
    expect(сОплатой).toHaveLength(1);
    expect(сОплатой[0].tierId).toBe("medium");
    expect(String(сОплатой[0].сообщение)).toContain("оплачено");
    // Адрес целиком не уходит и в Sentry — только домен.
    expect(JSON.stringify(сОплатой[0])).not.toContain("buyer@example.com");
  });

  test("режим заглушки НЕ заводит событие: это настройка, а не происшествие", async () => {
    // Без ключа отправщик отвечает {ok:true, mode:"stub"} — письма не было вовсе.
    // Предупреждение в журнал нужно, событие на каждую оплату — нет: оно утопило
    // бы настоящие отказы, пока ключ не задан.
    delete process.env.RESEND_API_KEY;
    process.env.SUBSCRIPTIONS_FILE = join(ВРЕМЕННЫЙ, "subscriptions.jsonl");
    vi.resetModules();
    const { provisionSubscription } = await import("../src/routes/provisioning");

    const r = await provisionSubscription(ПОКУПКА);

    expect(r.emailMode).toBe("stub");
    expect(события.filter((e) => e.subscriptionId === r.subscription.id)).toHaveLength(0);
  });

  test("контроль: письмо ушло — следа об отказе нет", async () => {
    const { provisionSubscription } = await загрузить();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_ok_1" }),
    })) as unknown as typeof fetch;

    const r = await provisionSubscription(ПОКУПКА);

    expect(r.emailSent).toBe(true);
    expect(ошибки.filter((s) => s.includes("ОПЛАЧЕНО"))).toHaveLength(0);
  });
});
