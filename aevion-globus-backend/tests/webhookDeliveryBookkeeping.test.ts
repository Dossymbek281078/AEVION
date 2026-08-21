import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { deliverWebhook } from "../src/lib/webhookDelivery";

/**
 * После доставки вебхука функция записывает отметку: `lastDeliveredAt` при
 * успехе, `lastFailedAt` при отказе. Обе записи были обёрнуты в
 * `.catch(() => {})` — то есть если запись не прошла, об этом не оставалось
 * ничего.
 *
 * Отметка о доставке — единственное, по чему потом судят, дошёл ли вебхук. Не
 * записалась — таблица показывает ПРОШЛОЕ состояние как настоящее, и это тот же
 * класс, что «устаревший счётчик меньше правды».
 *
 * Дефект выдала непоследовательность внутри одной функции: соседняя запись
 * (вставка в журнал доставок) при отказе в журнал ПИШЕТ, а эти две молчали.
 *
 * Доставку не роняем: вебхук уже ушёл, и результат вызвавшему возвращается
 * прежний. Меняется только то, что отказ записи перестал быть невидимым.
 */

const CFG = {
  webhookTable: "Webhook",
  deliveryTable: "WebhookDelivery",
  userAgent: "AEVION-test",
} as never;

const OPTS = {
  webhookId: "wh-1",
  url: "https://example.invalid/hook",
  secret: "s3cret",
  eventType: "test.event",
  body: JSON.stringify({ a: 1 }),
} as never;

describe("Отметка о доставке вебхука: отказ записи виден", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); });

  test("успешная доставка: отказ записи отметки попадает в журнал", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }));
    const pool = {
      query: vi.fn().mockImplementation((sql: string) =>
        /UPDATE/.test(sql) ? Promise.reject(new Error("db down")) : Promise.resolve({ rows: [] }),
      ),
    } as never;

    const r = await deliverWebhook(pool, CFG, OPTS);
    await new Promise((res) => setTimeout(res, 10));

    // Результат вызвавшему не меняется: вебхук ушёл.
    expect(r.ok).toBe(true);
    const said = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(said).toContain("wh-1");
  });

  test("неудачная доставка: отказ записи отметки тоже попадает в журнал", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "" }));
    const pool = {
      query: vi.fn().mockImplementation((sql: string) =>
        /UPDATE/.test(sql) ? Promise.reject(new Error("db down")) : Promise.resolve({ rows: [] }),
      ),
    } as never;

    const r = await deliverWebhook(pool, CFG, OPTS);
    await new Promise((res) => setTimeout(res, 10));

    expect(r.ok).toBe(false);
    const said = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(said).toContain("wh-1");
  });

  test("когда запись проходит — лишних предупреждений нет (контроль)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }));
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as never;

    await deliverWebhook(pool, CFG, OPTS);
    await new Promise((res) => setTimeout(res, 10));

    const said = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(said).not.toContain("отметка");
  });
});
