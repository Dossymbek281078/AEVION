import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Сторож: сбой чтения подписки НА ВОРОТАХ оставляет след.
 *
 * ЧТО ЗДЕСЬ ВАЖНО. readLatestSubscription при сбое чтения возвращает null —
 * то есть ворота считают, что подписки НЕТ, и заплативший видит «Free,
 * оформите подписку». Этот случай в репозитории уже был настоящим дефектом.
 *
 * Поведение сторож НЕ меняет и менять не просит: бросать на воротах нельзя,
 * иначе недоступность хранилища станет полным отказом платформы вместо
 * частичного. Охраняется ровно одно — что отказ ВИДЕН.
 *
 * Замер 02.09.2026 пробой со сломанным хранилищем: следа не было вовсе.
 */
const { следы } = vi.hoisted(() => ({ следы: [] as string[] }));
const { режим } = vi.hoisted(() => ({ режим: { сломано: true } }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (e: unknown, ctx?: Record<string, unknown>) => {
    следы.push(String(ctx?.route ?? (e instanceof Error ? e.message : e)));
  },
}));

vi.mock("node:fs", async (real) => {
  const fs = await real<typeof import("node:fs")>();
  const про = (p: unknown) => String(p).includes("subscriptions");
  return {
    ...fs,
    default: fs,
    existsSync: (p: string) => (про(p) ? true : fs.existsSync(p)),
    readFileSync: (p: string, ...a: unknown[]) => {
      if (про(p) && режим.сломано) throw new Error("диск недоступен");
      return (fs.readFileSync as (...x: unknown[]) => unknown)(p, ...a);
    },
  };
});

const { readLatestSubscription } = await import("../src/routes/provisioning");

beforeEach(() => {
  следы.length = 0;
  режим.сломано = true;
});

describe("сбой чтения на воротах виден", () => {
  test("поведение прежнее: возвращается null, ворота не падают", async () => {
    expect(
      readLatestSubscription("buyer@example.test"),
      "ворота начали бросать — это превратит частичный сбой в полный отказ"
    ).toBeNull();
  });

  test("но след остаётся", async () => {
    readLatestSubscription("buyer@example.test");
    expect(
      следы,
      "сбой чтения на воротах не оставил следа: заплативший увидит «Free», и узнать об этом будет неоткуда"
    ).toContain("provisioning/readLatestSubscription");
  });

  test("КОНТРОЛЬ: исправное хранилище следа НЕ оставляет", async () => {
    // Иначе «след есть» удовлетворялся бы кодом, который шлёт тревогу на
    // КАЖДОЕ чтение подписки — то есть машиной ложных тревог на горячем пути.
    режим.сломано = false;
    readLatestSubscription("buyer@example.test");
    expect(следы, "тревога ушла при исправном чтении").toEqual([]);
  });
});
