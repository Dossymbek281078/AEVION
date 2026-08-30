import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInMemoryRateLimiter, clientIp } from "../src/lib/rateLimit/inMemoryWindow";

/**
 * Общий примитив: на нём стоят pipeline, quantum-shield и суточный потолок
 * публикаций биржи. У последнего окно — сутки, поэтому здесь проверяется не
 * только «считает попытки», но и два свойства, ради которых примитив менялся:
 * `peek` не тратит попытку, а уборка ключей не выбрасывает живые.
 */
describe("createInMemoryRateLimiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("check тратит попытку и закрывает окно на исчерпании", () => {
    const rl = createInMemoryRateLimiter({ max: 2, windowMs: 1000 });
    expect(rl.check("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(rl.check("a")).toMatchObject({ allowed: true, remaining: 0 });
    const denied = rl.check("a");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    // Чужой ключ живёт своей жизнью.
    expect(rl.check("b").allowed).toBe(true);
  });

  it("peek отвечает тот же вердикт, но ничего не тратит", () => {
    const rl = createInMemoryRateLimiter({ max: 2, windowMs: 1000 });
    for (let i = 0; i < 5; i++) expect(rl.peek("a")).toMatchObject({ allowed: true, remaining: 2 });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.peek("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.peek("a")).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("попытки истекают вместе с окном", () => {
    const rl = createInMemoryRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rl.check("a").allowed).toBe(true);
  });

  it("уборка ключей не выбрасывает живые попытки суточного окна", () => {
    const day = 24 * 60 * 60_000;
    const rl = createInMemoryRateLimiter({ max: 2, windowMs: day });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(true);
    // Уборка запускается раз в минуту: без неё карта суточного окна росла бы
    // весь день. Но пройти по ней она должна мимо ключа, у которого попытки ещё
    // живы, — иначе потолок сбрасывался бы каждую минуту и не значил ничего.
    vi.advanceTimersByTime(61_000);
    expect(rl.peek("a")).toMatchObject({ allowed: false, remaining: 0 });
    vi.advanceTimersByTime(day);
    expect(rl.peek("a")).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("reset очищает всё", () => {
    const rl = createInMemoryRateLimiter({ max: 1, windowMs: 1000 });
    rl.check("a");
    expect(rl.peek("a").allowed).toBe(false);
    rl.reset();
    expect(rl.peek("a").allowed).toBe(true);
  });
});

/**
 * По этому адресу считаются три вещи сразу: суточный потолок публикаций,
 * счётчик показов заявки и дедуп жалоб. Ошибка здесь тихо склеивает разных
 * людей в одного (или наоборот) — поэтому разбор заголовка пришпилен.
 */
describe("clientIp", () => {
  const req = (headers: Record<string, string | string[] | undefined>, ip?: string) =>
    ({ headers, ip } as unknown as Parameters<typeof clientIp>[0]);

  // ПОЧЕМУ ЭТОТ БЛОК ПЕРЕПИСАН ПРИ СВЕДЕНИИ 30.08.2026.
  //
  // Здесь стояли проверки «берёт ПЕРВЫЙ адрес из X-Forwarded-For». Они пришли
  // из ветки биржи и закрепляли ровно тот способ, которым ограничитель у нас
  // обходили: заголовок пишет сам вызывающий, и предел снимается одной
  // строкой в запросе. Платформа это решение уже приняла в другую сторону —
  // общий rateLimit берёт адрес соединения и лишь ОТМЕЧАЕТ наличие заголовка,
  // не доверяя ему.
  //
  // Поэтому проверки ниже утверждают ПРОТИВОПОЛОЖНОЕ: подделанный заголовок
  // не должен менять ключ. Это не придирка к чужому тесту — это разница между
  // «предел есть» и «предел работает».

  it("подделанный X-Forwarded-For НЕ меняет ключ", () => {
    const real = clientIp(req({}, "198.51.100.4"));
    const forged = clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }, "198.51.100.4"));
    expect(forged, "заголовок от клиента подменил ключ — предел обходится одной строкой")
      .toBe(real);
  });

  it("заголовок массивом тоже не меняет ключ", () => {
    const real = clientIp(req({}, "198.51.100.4"));
    expect(clientIp(req({ "x-forwarded-for": ["203.0.113.7", "8.8.8.8"] }, "198.51.100.4")))
      .toBe(real);
  });

  it("без заголовка — адрес соединения, а не пустая строка", () => {
    expect(clientIp(req({}, "198.51.100.4"))).toBe("198.51.100.4");
    // «unknown» — общий ключ на всех, поэтому важно, что он появляется только
    // когда адреса действительно нет.
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": "" }, "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("IPv6 сводится к сети, а не к отдельному адресу", () => {
    // У домашней раздачи IPv6 весь /64 принадлежит одному человеку. Считая
    // каждый адрес отдельным клиентом, предел не ограничивает никого:
    // замер показал «20 регистраций в минуту» при действующем ограничителе.
    const a1 = clientIp(req({}, "2001:db8:1:1::1"));
    const a2 = clientIp(req({}, "2001:db8:1:1::2"));
    expect(a1, "два адреса одной /64 должны давать ОДИН ключ").toBe(a2);
  });
});
