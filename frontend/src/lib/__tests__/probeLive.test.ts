import { describe, expect, test, vi, afterEach } from "vitest";

import { probeLive, daysUntil } from "../probeLive";

// Проба живости для посадочных запуска — 19.08.2026.
//
// Функция короткая, но её правило неочевидно и легко «поправить» в обратную
// сторону: живым считается всё, что ответило НЕ 404, а не только 2xx. Без теста
// первый же читатель заменит это на `r.ok`, сочтя опечаткой, — и страницы начнут
// писать «проверяется» о работающих контурах.
//
// Почему именно так: у модулей, ради которых функция написана, осмысленные
// ответы как раз не 2xx.
//   POST /api/multichat/receipt/verify с неверным пакетом → 400 (поля проверены)
//   GET  /api/multichat/conversations без токена          → 402 (платная стена)
// А 404 отвечает и на несуществующий путь внутри живого роутера, и на
// отсутствующий роутер — то есть именно он означает «этого нет».

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Подменяет fetch фиксированным статусом и запоминает переданные аргументы. */
function stubFetch(status: number) {
  const calls: Array<[string, RequestInit | undefined]> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push([String(url), init]);
      return Promise.resolve({ status, ok: status >= 200 && status < 300 } as Response);
    }),
  );
  return calls;
}

describe("probeLive — что считается живым", () => {
  test("200 — живой", async () => {
    stubFetch(200);
    await expect(probeLive("/api/x")).resolves.toBe(true);
  });

  test("400 живой: поля проверены, значит роут работает", async () => {
    // Ровно случай проверки чека заведомо неверным пакетом.
    stubFetch(400);
    await expect(probeLive("/api/multichat/receipt/verify")).resolves.toBe(true);
  });

  test("402 живой: платная стена — это работающая стена", async () => {
    stubFetch(402);
    await expect(probeLive("/api/multichat/conversations")).resolves.toBe(true);
  });

  test("401 и 403 живые — отказ доступа не значит отсутствие", async () => {
    stubFetch(401);
    await expect(probeLive("/api/x")).resolves.toBe(true);
    vi.unstubAllGlobals();
    stubFetch(403);
    await expect(probeLive("/api/x")).resolves.toBe(true);
  });

  test("404 — единственный ответ, означающий «этого нет»", async () => {
    stubFetch(404);
    await expect(probeLive("/api/нет-такого")).resolves.toBe(false);
  });

  test("500 живой: сервер отвечает, значит роут смонтирован", async () => {
    // Спорный на вид случай, поэтому зафиксирован: 500 говорит о поломке
    // обработчика, а не об отсутствии модуля. Страница обещает наличие контура,
    // а не его безошибочность.
    stubFetch(500);
    await expect(probeLive("/api/x")).resolves.toBe(true);
  });

  test("сетевая ошибка — «не подтвердилось», а не «мертво»", async () => {
    // Возвращаем false, и страница честно скажет «проверяется». Объявить контур
    // сломанным из-за таймаута сборки было бы хуже.
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNRESET"))));
    await expect(probeLive("/api/x")).resolves.toBe(false);
  });

  test("init прокидывается, а срок кэша задаётся всегда", async () => {
    // Пробы идут при сборке: без revalidate страница брала бы результат
    // бессрочно, и «работает» могло бы висеть месяцами после поломки.
    const calls = stubFetch(400);
    await probeLive("/api/x", { method: "POST", body: "{}" });
    const [, init] = calls[0];
    expect((init as { method?: string })?.method).toBe("POST");
    expect((init as { body?: string })?.body).toBe("{}");
    expect((init as { next?: { revalidate?: number } })?.next?.revalidate).toBe(1800);
  });
});

describe("daysUntil — счёт по UTC-полуночи", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("до даты — положительное число, в день — ноль", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T21:30:00Z"));
    expect(daysUntil(2026, 8, 13)).toBe(3);
    vi.setSystemTime(new Date("2026-09-13T00:00:01Z"));
    expect(daysUntil(2026, 8, 13)).toBe(0);
  });

  test("вечер и утро одного дня дают одинаковый ответ", () => {
    // Именно ради этого счёт идёт от UTC-полуночи: иначе страница, собранная
    // вечером и утром одного дня, показала бы разное число дней.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T23:59:00Z"));
    const evening = daysUntil(2026, 8, 20);
    vi.setSystemTime(new Date("2026-09-01T00:01:00Z"));
    expect(daysUntil(2026, 8, 20)).toBe(evening);
  });

  test("после даты — отрицательное, страница скажет «уже открыто»", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    expect(daysUntil(2026, 8, 20)).toBeLessThan(0);
  });
});
