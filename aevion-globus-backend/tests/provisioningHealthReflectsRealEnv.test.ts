import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: ручка состояния выдачи купленного отражает НАСТОЯЩЕЕ окружение.
 *
 * ЗАЧЕМ. `/api/pricing/provisioning/healthz` — прибор, по которому судят,
 * работает ли выдача: уходят ли письма покупателю (`emailMode`) и есть ли
 * хранилище подписок (`storageExists`). Замер 02.09.2026: обе мутации —
 * «отвечать всегда real» и «хранилище всегда есть» — НЕ ловились ни одним
 * из 17 файлов, где упоминаются provisioning, emailMode или storageExists.
 *
 * Опасное направление именно ложно-хорошее: «real» при отсутствующем ключе
 * означало бы, что мы считаем письма уходящими, когда они не уходят, —
 * покупатель заплатил и не получил ничего, а прибор спокоен.
 *
 * Значения переменных НЕ печатаются: проверяется только соответствие.
 */
const ПОЧТА = "RESEND_API_KEY";
const ХРАНИЛИЩЕ = "SUBSCRIPTIONS_FILE";

const сохранено: Record<string, string | undefined> = {};
let каталог: string | null = null;

beforeEach(() => {
  for (const п of [ПОЧТА, ХРАНИЛИЩЕ]) сохранено[п] = process.env[п];
});

afterAll(() => {
  for (const [п, з] of Object.entries(сохранено)) {
    if (з === undefined) delete process.env[п];
    else process.env[п] = з;
  }
  // За собой убираем: временные каталоги, оставленные тестами, уже были
  // находкой в этом репозитории.
  if (каталог) rmSync(каталог, { recursive: true, force: true });
});

/**
 * Модуль читает ключ почты ОДИН раз, на уровне модуля. Поэтому менять
 * окружение после импорта бесполезно — импортируем заново под каждый случай.
 */
async function состояние() {
  vi.resetModules();
  const { provisioningRouter } = await import("../src/routes/provisioning");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/provisioning", provisioningRouter);
  const res = await request(app).get("/api/pricing/provisioning/healthz");
  expect(res.status).toBe(200);
  return res.body as Record<string, unknown>;
}

describe("состояние выдачи совпадает с окружением", () => {
  test("КОНТРОЛЬ: ручка отдаёт оба поля", async () => {
    const п = await состояние();
    for (const поле of ["emailMode", "storageExists"]) {
      expect(п, `поля ${поле} нет — проверять нечего`).toHaveProperty(поле);
    }
  });

  test("ключа почты НЕТ — ручка НЕ говорит «письма уходят»", async () => {
    delete process.env[ПОЧТА];
    const п = await состояние();
    expect(
      п.emailMode,
      "ключа нет, а ручка объявляет отправку настоящей — покупатель не получит письма, а прибор спокоен"
    ).not.toBe("real");
  });

  test("ключ почты ЕСТЬ — ручка это показывает", async () => {
    // Вторая половина пары: без неё проверка проходила бы и на коде,
    // который отвечает «stub» ВСЕГДА.
    process.env[ПОЧТА] = "x-not-a-real-secret";
    const п = await состояние();
    expect(п.emailMode, "ключ задан, а ручка этого не показывает").toBe("real");
  });

  test("хранилища нет — storageExists false; появилось — true", async () => {
    каталог = mkdtempSync(join(tmpdir(), "aevion-prov-"));
    const путь = join(каталог, "subs.jsonl");

    process.env[ХРАНИЛИЩЕ] = путь;
    const до = await состояние();
    expect(до.storageExists, "файла ещё нет, а ручка говорит, что есть").toBe(false);

    writeFileSync(путь, "");
    const после = await состояние();
    expect(после.storageExists, "файл создан, а ручка его не видит").toBe(true);
  });
});
