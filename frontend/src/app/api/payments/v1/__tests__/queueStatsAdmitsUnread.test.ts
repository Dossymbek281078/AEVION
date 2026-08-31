import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: сводка очереди повторов признаётся, что не смогла её прочитать.
 *
 * ЗАЧЕМ. Оператор спрашивает GET /webhooks/process, чтобы понять, есть ли
 * застрявшие доставки. При недоступном хранилище сводка отвечала
 * «ожидающих 0, ближайшая доставка — нет» — то есть «всё спокойно» ровно
 * тогда, когда доставки не видны.
 *
 * Опасный путь (processDue, который ПЕРЕЗАПИСЫВАЕТ очередь) в этом файле уже
 * был защищён признаком unread. Здесь тот же признак доведён до сводки: в
 * одном файле один образец.
 */
vi.mock("../_persist", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, kvListChecked: vi.fn(async () => ({ ok: false })), kvPush: vi.fn(async () => undefined) };
});

describe("сводка очереди не выдаёт молчание за спокойствие", () => {
  it("при нечитаемом хранилище ставит признак unread", async () => {
    const { queueStats } = await import("../_webhook_queue");
    const s = await queueStats();
    expect(s.unread, "сводка не призналась, что очередь не прочитана").toBe(true);
    expect(s.pending, "нули без признака читались бы как «всё спокойно»").toBe(0);
  });
});
