import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * «31 подписка» на ручке `subscriptions/count` была числом СТРОК в
 * дописывающем хранилище, а не числом людей. Отмена подписки дописывает
 * вторую строку на тот же адрес, продление — третью, и все они считались.
 *
 * Здесь проверяется, что рядом со старым числом стоит настоящее: уникальные
 * адреса, у которых последняя запись платная и срок не истёк.
 *
 * Перевод строки берётся через String.fromCharCode — как и в самом
 * provisioning.ts: обратный слэш в этом репозитории уже не раз съедался на
 * границе вызова и превращал литерал в незакрытую строку.
 */
const dir = mkdtempSync(join(tmpdir(), "aevion-subs-"));
const file = join(dir, "subscriptions.jsonl");

const впереди = new Date(Date.now() + 30 * 86400000).toISOString();
const позади = new Date(Date.now() - 30 * 86400000).toISOString();

const запись = (email: string, tierId: string, validUntil: string) =>
  JSON.stringify({
    id: email + tierId + validUntil,
    ts: new Date().toISOString(),
    email,
    tierId,
    period: "monthly",
    seats: 1,
    modules: [],
    trialDays: 0,
    validUntil,
  });

beforeAll(() => {
  // Порядок в файле = порядок событий, новые СНИЗУ.
  const строки = [
    запись("a@example.com", "full", впереди),   // купил
    запись("b@example.com", "full", впереди),   // купил
    запись("b@example.com", "free", впереди),   // ...и отменил: вторая строка
    запись("c@example.com", "full", позади),    // купил, срок истёк
    запись("a@example.com", "full", впереди),   // продлил: третья строка живого
  ];
  writeFileSync(file, строки.join(String.fromCharCode(10)) + String.fromCharCode(10), "utf8");
  process.env.SUBSCRIPTIONS_FILE = file;
});

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  rmSync(dir, { recursive: true, force: true });
});

describe("счёт подписок: записи и люди — разные числа", () => {
  test("total считает строки, active считает людей", async () => {
    const { countSubscriptions } = await import("../src/routes/provisioning");
    const r = countSubscriptions();

    expect(r.ok).toBe(true);
    // Пять событий в журнале.
    expect(r.total, "total обязан остаться счётом ЗАПИСЕЙ — по нему ловят потерю хранилища").toBe(5);
    // И ровно один человек, который сейчас платит: b отменил, c истёк,
    // a дважды — но это один адрес.
    expect(r.active, "живым считается один адрес: b отменил, c истёк, a задвоен").toBe(1);
  });

  test("отменённая и истёкшая подписки не считаются живыми", async () => {
    const { getActivePlan } = await import("../src/routes/provisioning");
    // Контроль в обе стороны: живой обязан находиться, остальные — нет.
    expect(getActivePlan("a@example.com").active, "живая подписка не найдена — тест смотрит не туда").toBe(true);
    expect(getActivePlan("b@example.com").active, "отменённая засчитана как живая").toBe(false);
    expect(getActivePlan("c@example.com").active, "истёкший срок засчитан как живой").toBe(false);
  });
});
