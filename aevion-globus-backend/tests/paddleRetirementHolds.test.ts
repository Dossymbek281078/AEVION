import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  PADDLE_KEY,
  paddleGet,
  paddlePost,
  createPaddleTransaction,
  verifyPaddleWebhook,
} from "../src/lib/paddleClient";

// Paddle снят с эксплуатации 22.07.2026 (PR #779), KYC не пройдена, деньги идут
// через Gumroad. Этот сторож проверяет, что уход ДЕРЖИТСЯ.
//
// Зачем: если Paddle случайно снова окажется на пути оплаты, платежи не упадут
// заметно — `paddlePost` при отказе провайдера возвращает null, и кнопка «купить»
// просто не приведёт никуда. Молчаливая потеря продажи, а не ошибка.
//
// ⚠️ ЕСЛИ KYC ПРОЙДЕНА и Paddle возвращают осознанно — этот файл НАДО УДАЛИТЬ.
// Он существует, чтобы поймать случайную перепроводку, а не чтобы запретить
// Paddle навсегда. Сторож, наказывающий за настоящий прогресс, — дефект сторожа.

const SRC = join(__dirname, "..", "src");

/** Все .ts в src/, кроме самого клиента: он и есть определение этих функций. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (name.endsWith(".ts") && name !== "paddleClient.ts") out.push(p);
  }
  return out;
}

describe("уход Paddle держится: ни одного живого пути оплаты", () => {
  const files = sourceFiles(SRC);

  test("прибор видит файлы и умеет находить то, что там ЕСТЬ", () => {
    // Отрицательный контроль: без него «ноль совпадений» ниже мог бы означать
    // «сканер ничего не прочитал», а не «вызовов нет».
    expect(files.length).toBeGreaterThan(50);
    const revenue = files.find((f) => f.endsWith("revenue.ts"))!;
    expect(readFileSync(revenue, "utf8")).toContain("paddleGet");
  });

  for (const sym of ["createPaddleTransaction", "paddlePost", "verifyPaddleWebhook"]) {
    test(`${sym} не вызывается ни из одного модуля`, () => {
      const callers = files.filter((f) => readFileSync(f, "utf8").includes(sym));
      expect(callers.map((f) => f.replace(SRC, "src"))).toEqual([]);
    });
  }

  test("вебхук Paddle отвечает громким 410, а не тихим 200", () => {
    // Тихий 200 на удалённый вебхук — худший исход: провайдер считает событие
    // принятым, а мы его не обработали. Проверяем, что громкость сохранена.
    const checkout = readFileSync(join(SRC, "routes", "checkout.ts"), "utf8");
    expect(checkout).toMatch(/status\(410\)/);
  });
});

describe("чтение баланса без ключа не ходит в сеть", () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.PADDLE_API_KEY;

  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("сетевой вызов при пустом ключе — этого быть не должно");
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = realKey;
  });

  test("без ключа paddleGet отдаёт null и не трогает сеть", async () => {
    delete process.env.PADDLE_API_KEY;
    expect(PADDLE_KEY()).toBe("");
    await expect(paddleGet("/transactions")).resolves.toBeNull();
  });

  test("без ключа paddlePost тоже не трогает сеть", async () => {
    delete process.env.PADDLE_API_KEY;
    await expect(paddlePost("/transactions", {})).resolves.toBeNull();
  });

  test("createPaddleTransaction без ключа возвращает null, а не бросает", async () => {
    // Если бы он бросал, вызывающий получил бы 500 вместо честного «нет канала».
    delete process.env.PADDLE_API_KEY;
    await expect(
      createPaddleTransaction({
        amountCents: 100,
        currency: "usd",
        description: "проверка",
        successUrl: "https://aevion.app/ok",
      }),
    ).resolves.toBeNull();
  });

  test("проверка подписи вебхука не зависит от сети и отвергает мусор", () => {
    expect(verifyPaddleWebhook("{}", "мусор", "секрет")).toBe(false);
    expect(verifyPaddleWebhook("{}", "ts=1;h1=zz", "секрет")).toBe(false);
  });
});
