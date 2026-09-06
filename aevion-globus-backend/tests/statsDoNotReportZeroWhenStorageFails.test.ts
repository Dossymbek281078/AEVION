import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: при нечитаемом хранилище отчёт НЕ говорит «продаж ноль».
 *
 * ЧТО БЫЛО (замер 02.09.2026, проба со сломанным хранилищем). readSubscriptions
 * делала `catch { return [] }`, поэтому /stats отвечал 200 и «всего 0» по ВСЕМ
 * тарифам. Панель показала бы «продаж нет» при целых продажах, и отличить это
 * от правды было нечем.
 *
 * Соседняя функция countSubscriptions, читающая ТОТ ЖЕ файл, честно возвращала
 * ok:false — два читателя одного файла с противоположной дисциплиной.
 *
 * Проверяются ОБЕ стороны: сбой чтения обязан быть виден, а отсутствие файла
 * по-прежнему остаётся честным нулём. Без второй половины сторож проходил бы
 * и на коде, который всегда отвечает ошибкой.
 */
const { режим } = vi.hoisted(() => ({ режим: { сломано: true } }));

vi.mock("node:fs", async (real) => {
  const fs = await real<typeof import("node:fs")>();
  const про = (p: unknown) => String(p).includes("subscriptions");
  return {
    ...fs,
    default: fs,
    existsSync: (p: string) => (про(p) ? режим.сломано : fs.existsSync(p)),
    readFileSync: (p: string, ...a: unknown[]) => {
      if (про(p) && режим.сломано) throw new Error("диск недоступен");
      return (fs.readFileSync as (...x: unknown[]) => unknown)(p, ...a);
    },
  };
});

const { provisioningRouter } = await import("../src/routes/provisioning");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/provisioning", provisioningRouter);
  return a;
}

beforeEach(() => {
  режим.сломано = true;
});

describe("отчёт о подписках честен к состоянию хранилища", () => {
  test("хранилище НЕ читается — отчёт не выдаёт ноль за правду", async () => {
    const r = await request(приложение()).get("/api/pricing/provisioning/stats");
    const выдалНоль = r.status === 200 && (r.body as { total?: number }).total === 0;
    expect(
      выдалНоль,
      `сбой чтения выдан за «продаж ноль»: панель покажет «никто не купил» при целых продажах. Ответ: ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`
    ).toBe(false);
  });

  test("КОНТРОЛЬ: файла НЕТ — это честный ноль, а не ошибка", async () => {
    // Иначе первую проверку удовлетворял бы код, который отвечает ошибкой
    // ВСЕГДА, — то есть сломанный отчёт.
    режим.сломано = false;
    const r = await request(приложение()).get("/api/pricing/provisioning/stats");
    expect(r.status, "отсутствие файла принято за поломку").toBe(200);
    expect((r.body as { total?: number }).total, "честный ноль не отдан").toBe(0);
  });
});
