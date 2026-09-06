import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: сбой чтения журналов программы партнёров оставляет след.
 *
 * ЧТО БЫЛО (замер 02.09.2026, проба со сломанным хранилищем). Общий читатель
 * readJsonlAll возвращал пустой список при сбое чтения. Следствия для
 * человека, оба молча:
 *   • нечитаемый файл заявок → партнёру отвечают 404 «вас нет»;
 *   • нечитаемый файл сделок → партнёр видит НУЛЕВЫЕ комиссии.
 *
 * Поведение сторож НЕ меняет: у части обработчиков есть свой catch, бросок
 * они всё равно проглотят. Охраняется одно — что отказ ВИДЕН.
 *
 * Это четвёртый брат одного класса: countSubscriptions, readSubscriptions,
 * readLatestSubscription и вот этот читатель.
 */
const { следы } = vi.hoisted(() => ({ следы: [] as string[] }));
const { режим } = vi.hoisted(() => ({ режим: { сломано: true } }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (_e: unknown, ctx?: Record<string, unknown>) => {
    следы.push(String(ctx?.route ?? "?"));
  },
}));

vi.mock("node:fs", async (real) => {
  const fs = await real<typeof import("node:fs")>();
  const про = (p: unknown) => /partner|affiliate/i.test(String(p));
  return {
    ...fs,
    default: fs,
    existsSync: (p: string) => (про(p) && режим.сломано ? true : fs.existsSync(p)),
    readFileSync: (p: string, ...a: unknown[]) => {
      if (про(p) && режим.сломано) throw new Error("диск недоступен");
      return (fs.readFileSync as (...x: unknown[]) => unknown)(p, ...a);
    },
  };
});

const { pricingRouter } = await import("../src/routes/pricing");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

beforeEach(() => {
  следы.length = 0;
  режим.сломано = true;
});

describe("сбой чтения журналов программы виден", () => {
  test("нечитаемый журнал оставляет след", async () => {
    await request(приложение())
      .post("/api/pricing/partners/magic-link")
      .send({ email: "p@example.test" });
    expect(
      следы,
      "журнал не прочитан, а следа нет: партнёру ответят «вас нет», и узнать об этом будет неоткуда"
    ).toContain("pricing/readJsonlAll");
  });

  test("КОНТРОЛЬ: исправное чтение следа НЕ оставляет", async () => {
    // Иначе «след есть» удовлетворялся бы кодом, который шлёт тревогу на
    // каждое чтение журнала.
    режим.сломано = false;
    await request(приложение())
      .post("/api/pricing/partners/magic-link")
      .send({ email: "p2@example.test" });
    expect(следы, "тревога ушла при исправном чтении").toEqual([]);
  });
});
