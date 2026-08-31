import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Сторож: провал аудиторской записи оставляет след.
 *
 * ЗАЧЕМ. В `logAudit` стояло `catch { }` с пояснением «best-effort; never fail
 * the underlying request because of audit». Направление отказа выбрано ВЕРНО:
 * аудит не должен ронять операцию, ради которой его пишут. Но молчание —
 * отдельная беда: дыра в следе не оставляла ни одного признака.
 *
 * А след этот на денежных маршрутах: возвраты, споры, чекаут, ссылки. Запись
 * пропала — событие произошло, доказательства нет, и узнать неоткуда.
 *
 * Проверяем ОБА свойства сразу: операция не падает И след появляется.
 */
vi.mock("../_persist", () => ({
  kvPush: vi.fn(async () => {
    throw new Error("хранилище недоступно");
  }),
  kvList: vi.fn(async () => []),
}));

const запрос = () =>
  ({
    headers: { get: () => null },
  }) as never;

let предупреждения: string[] = [];
let прежний: typeof console.warn;

beforeEach(() => {
  предупреждения = [];
  прежний = console.warn;
  console.warn = (...a: unknown[]) => предупреждения.push(a.join(" "));
});
afterEach(() => {
  console.warn = прежний;
});

describe("провал аудита виден, но не роняет операцию", () => {
  it("исключение не выходит наружу, а в журнале остаётся причина", async () => {
    const { logAudit } = await import("../_audit");
    await expect(
      logAudit(запрос(), "refund.issued", "ref_123", { amount: 19 }),
    ).resolves.toBeUndefined();

    expect(предупреждения.length, "провал аудита прошёл молча").toBeGreaterThan(0);
    const строка = предупреждения.join(" | ");
    expect(строка, "в следе нет ДЕЙСТВИЯ").toContain("refund.issued");
    expect(строка, "в следе нет ЦЕЛИ").toContain("ref_123");
    expect(строка, "в следе нет причины").toContain("хранилище недоступно");
  });
});
