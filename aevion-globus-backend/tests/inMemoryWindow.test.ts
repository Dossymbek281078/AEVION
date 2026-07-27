import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInMemoryRateLimiter } from "../src/lib/rateLimit/inMemoryWindow";

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
