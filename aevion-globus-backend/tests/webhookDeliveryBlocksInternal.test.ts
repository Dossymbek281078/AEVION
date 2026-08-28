/**
 * Общий отправитель вебхуков не ходит по внутренним адресам.
 *
 * ЗАЧЕМ. `deliverWebhook` — единственное место, где происходит само
 * обращение, и оно общее для QRight, Planet и других. Адрес приходит от
 * пользователя: у QRight при регистрации проверялся только протокол, у
 * Planet — только длина, а внутренние адреса не блокировались нигде.
 *
 * Проверка стоит на ДОСТАВКЕ намеренно: гейт на входе не защищает то, что уже
 * сохранено. Ровно эту щель я 28.08 нашёл в собственной починке вебхуков
 * тренажёра смет — там адрес проверялся при регистрации, а доставка шла без.
 *
 * ПОЧЕМУ ТЕСТ ТАКОЙ. Пул БД подменён объектом, который БРОСАЕТ при любом
 * обращении. Если проверка сработала, до записи в журнал дело не доходит и
 * бросок не случается; если её убрать — функция пойдёт дальше и тест это
 * увидит. Так проверяется не «вернулось нужное слово», а что путь ОБОРВАН
 * до обращения наружу.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { deliverWebhook } from "../src/lib/webhookDelivery";

// Любое обращение к БД — ошибка теста: значит проверка не оборвала путь.
const explodingPool = {
  query: () => { throw new Error("до БД дойти было НЕЛЬЗЯ — проверка адреса не сработала"); },
} as never;

const cfg = { table: "TestWebhookDelivery", userAgent: "AEVION-Test/1.0" } as never;

function attempt(url: string) {
  return {
    webhookId: "wh-test", url, secret: "s3cret",
    body: JSON.stringify({ hello: "world" }),
    eventType: "test.event", entityId: null, isRetry: false,
  };
}

const savedEnv = { ...process.env };
beforeEach(() => { delete process.env.NODE_ENV; delete process.env.ALLOW_INTERNAL_WEBHOOKS; });
afterEach(() => { process.env = { ...savedEnv }; });

describe("общий отправитель вебхуков", () => {
  it("не идёт на внутренние адреса и не трогает БД", async () => {
    const internal = [
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/x",
      "http://127.0.0.1:8080/hook",
      "http://10.0.0.5/hook",
      "http://[::1]/hook",
      // Тот же 127.0.0.1, записанный числом, шестнадцатерично, восьмерично и
      // коротко. Сама проверка хоста их НЕ узнаёт — она ждёт четыре десятичных
      // октета. Блокирует их связка: `new URL()` приводит все четыре формы к
      // 127.0.0.1 ещё до проверки. Держим их здесь, чтобы связка не распалась:
      // если однажды сюда придёт сырая строка мимо разбора, эти строки покраснеют.
      "http://2130706433/hook",
      "http://0x7f000001/hook",
      "http://017700000001/hook",
      "http://127.1/hook",
      "не-адрес",
    ];
    for (const url of internal) {
      const r = await deliverWebhook(explodingPool, cfg, attempt(url));
      expect(r.ok, `пошёл на внутренний адрес: ${url}`).toBe(false);
      expect(r.error, `не та причина отказа для ${url}`).toBe("target_not_allowed");
    }
  });

  it("контроль прибора: отдушина для тестов работает", async () => {
    // Без неё локальные прогоны с петлёй были бы невозможны — и это уже
    // ломало существующий тест доставки в LMS 28.08.
    process.env.ALLOW_INTERNAL_WEBHOOKS = "1";
    // С отдушиной проверка пропускает адрес и путь идёт дальше — до БД,
    // то есть подменённый пул бросает. Значит проверка ИМЕННО она обрывала.
    await expect(
      deliverWebhook(explodingPool, cfg, attempt("http://127.0.0.1:8080/hook")),
    ).rejects.toThrow(/до БД дойти было НЕЛЬЗЯ|fetch/i);
  });
});
