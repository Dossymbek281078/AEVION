import { describe, test, expect, vi, beforeEach } from "vitest";

// Публичная ручка /api/qventure/comparables каждым запросом делала ПЛАТНЫЙ
// вызов модели, 20.08.2026.
//
// Кэш в модуле был, но запись в него стояла ровно одна — в ветке "live",
// которая работает только при заданном SERPER_API_KEY. Ключ не задан, значит
// живая ветка не срабатывает никогда, а работающий образцовый режим не
// кэшировался ВООБЩЕ. Замер на проде: 6.5-11.6 с на ответ, вход не требуется,
// ограничитель пропускает 15 запросов в минуту с адреса — и каждый из них
// отдельный платный вызов, даже с тем же самым сектором.
//
// Считаем ВЫЗОВЫ, а не ловим исключение: подмена на бросающую заглушку тут
// ничего не доказала бы — вокруг стоит catch, который её проглотит, и тест
// был бы зелёным на сломанном коде.

const calls: string[] = [];

vi.mock("../src/services/qcoreai/providers", () => ({
  callProvider: vi.fn(async (_p: string, messages: any[]) => {
    const ask = String(messages?.[1]?.content ?? "");
    calls.push(ask.slice(0, 40));
    // Сектор со словом "empty" — тот случай, когда модель ничего не нашла:
    // платный вызов сделан, полезного ответа нет.
    if (ask.includes("empty")) return { reply: "[]" };
    return {
      reply: JSON.stringify([
        { company: "Acme", amountText: "$10M", amountUsd: 10_000_000, round: "Seed", date: "2025" },
      ]),
    };
  }),
  pickConfiguredProvider: () => "anthropic",
  getProviders: () => [{ id: "anthropic", defaultModel: "claude-opus-4-8" }],
}));

const { fetchComparables } = await import("../src/lib/qventure/comparables");

describe("qventure comparables — образцовый режим кэшируется", () => {
  beforeEach(() => {
    calls.length = 0;
    delete process.env.SERPER_API_KEY;   // живая ветка недоступна — как на проде
  });

  test("повтор с тем же сектором не тратит второй платный вызов", async () => {
    const a = await fetchComparables("fintech-repeat", "seed");
    const b = await fetchComparables("fintech-repeat", "seed");

    expect(a.mode).toBe("illustrative");
    expect(calls.length).toBe(1);            // главное утверждение
    expect((b as any).cached).toBe(true);
    expect(b.comps).toEqual(a.comps);
  });

  test("регистр сектора не создаёт второй вызов", async () => {
    await fetchComparables("BioTech-Case", "seed");
    await fetchComparables("biotech-case", "seed");
    expect(calls.length).toBe(1);
  });

  test("ДРУГОЙ сектор по-прежнему считается отдельно", async () => {
    // Отрицательный контроль: без него тест был бы зелёным и на коде,
    // который отдаёт один и тот же ответ на любой запрос.
    await fetchComparables("sector-one", "seed");
    await fetchComparables("sector-two", "seed");
    expect(calls.length).toBe(2);
  });

  test("другая стадия того же сектора — тоже отдельно", async () => {
    await fetchComparables("stage-probe", "seed");
    await fetchComparables("stage-probe", "series-a");
    expect(calls.length).toBe(2);
  });

  test("пустой ответ модели тоже не повторяет платный вызов", async () => {
    // Это путь ЗЛОУПОТРЕБЛЕНИЯ: бессмысленный сектор, модель ничего не
    // вернула — но деньги за вызов уже потрачены. Без кэша перебор случайных
    // секторов стоил бы по вызову на каждый.
    const a = await fetchComparables("empty-sector", "seed");
    const b = await fetchComparables("empty-sector", "seed");

    expect(a.mode).toBe("unavailable");
    expect(calls.length).toBe(1);
    expect((b as any).cached).toBe(true);
  });

  test("пустой ответ не заслоняет другой сектор", async () => {
    await fetchComparables("empty-one", "seed");
    await fetchComparables("empty-two", "seed");
    expect(calls.length).toBe(2);
  });
});
