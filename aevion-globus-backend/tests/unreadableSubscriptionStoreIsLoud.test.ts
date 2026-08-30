import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Нечитаемое хранилище подписок слышно, а отсутствующее — нет.
 *
 * Находка соседнего окна 30.08.2026, проверена здесь: `readLatestSubscription`
 * отвечала `null` и когда записей нет, и когда файл не удалось прочитать. Выше
 * по стеку `getActivePlan` превращает `null` в «tierId: free». То есть при
 * пропаже или порче файла КАЖДЫЙ заплативший тихо становился бесплатным, и
 * снаружи это неотличимо от «человек не платил»: ни строки в журнале, ни
 * признака в ответе, ни события.
 *
 * Разбирая, я нашёл, что случай шире описанного: молчал не только пропавший
 * файл, но и ЛЮБАЯ ошибка чтения — весь блок был обёрнут в
 * `catch { return null }`.
 *
 * Поведение намеренно НЕ меняется: отказ чтения по-прежнему не роняет запрос.
 * Меняется одно — он перестаёт быть невидимым. Ронять здесь нельзя: сбой чтения
 * не должен закрывать платящему доступ ко всему сразу.
 *
 * Отсутствие файла шуметь не должно: до первой покупки его законно нет, и
 * предупреждение на пустой системе утопило бы настоящее.
 *
 * ⚠️ Как сделан отказ чтения. По пути хранилища кладётся КАТАЛОГ: `existsSync`
 * отвечает «есть», `readFileSync` падает с EISDIR. Первая редакция подменяла
 * сам `readFileSync` шпионом — и не работала: привязка импортирована по имени,
 * шпион до неё не достаёт. Красное было в стенде, а не в продукте, и поймал это
 * контроль, стоящий первым.
 */

let dir: string;
let file: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "aevion-subs-"));
  file = join(dir, "subscriptions.jsonl");
  process.env.SUBSCRIPTIONS_FILE = file;
  vi.resetModules();
  const mod = await import("../src/routes/provisioning");
  mod.resetSubscriptionStoreWarning();
});

afterEach(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* временный каталог мог уже исчезнуть */
  }
});

describe("хранилище подписок: не знаю ≠ не платил", () => {
  test("контроль: обычное чтение работает и находит запись", async () => {
    // Без этого «тихо» ниже нельзя отличить от «функция вообще не работает».
    const mod = await import("../src/routes/provisioning");
    const line = JSON.stringify({
      email: "buyer@test.aev",
      tierId: "full",
      ts: new Date().toISOString(),
    });
    writeFileSync(file, line + String.fromCharCode(10), "utf8");
    const sub = mod.readLatestSubscription("buyer@test.aev");
    expect(sub?.tierId, "запись не найдена — стенд не про то").toBe("full");
    expect(mod.subscriptionStoreUnreadable(), "исправное чтение подняло тревогу").toBe(false);
  });

  test("файла нет вовсе — молчим: до первой покупки это норма", async () => {
    const mod = await import("../src/routes/provisioning");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mod.readLatestSubscription("nobody@test.aev")).toBeNull();
    expect(mod.subscriptionStoreUnreadable(), "пустая система объявлена сломанной").toBe(false);
    expect(err, "предупреждение на отсутствии файла утопит настоящее").not.toHaveBeenCalled();
    err.mockRestore();
  });

  test("файл есть, но не читается — говорим об этом громко", async () => {
    const mod = await import("../src/routes/provisioning");
    mkdirSync(file, { recursive: true });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    const got = mod.readLatestSubscription("buyer@test.aev");

    expect(got, "отказ чтения не должен ронять запрос").toBeNull();
    expect(
      err.mock.calls.length,
      "единственный путь, на котором заплативший отвечает как бесплатный, молчит",
    ).toBeGreaterThan(0);
    const said = err.mock.calls.flat().join(" ");
    expect(said, "в тревоге нет пути к файлу — не с чем идти разбираться").toContain(file);
    expect(mod.subscriptionStoreUnreadable(), "признак для ручек состояния не поднят").toBe(true);

    err.mockRestore();
  });

  test("кричим один раз на процесс, а не на каждый вызов", async () => {
    const mod = await import("../src/routes/provisioning");
    mkdirSync(file, { recursive: true });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    mod.readLatestSubscription("a@test.aev");
    mod.readLatestSubscription("b@test.aev");
    mod.readLatestSubscription("c@test.aev");

    expect(err.mock.calls.length, "журнал забьётся и настоящее потеряется").toBe(1);

    err.mockRestore();
  });
});
