/**
 * Сторож: отказ хранилища не должен выглядеть успехом и не должен стирать
 * накопленное.
 *
 * Сторож соседней ветки (`paymentLinkDurability.guard`) закрывает случай
 * «KV не настроен вовсе»: там страница честно предупреждает. Он НЕ смотрит
 * второй случай — «KV настроен и отвалился», а тот опаснее, потому что
 * выглядит здоровым: переменные на месте, /api/health говорит "kv",
 * страница обещает «навсегда», а запись уехала в память процесса.
 *
 * Самое дорогое здесь — kvPush. До 27.08.2026 он читал журнал через
 * `?? пустой список`, то есть упавшее чтение превращал в «журнал был пуст»,
 * и тут же записывал эту пустоту поверх настоящего. Под ключами лежат
 * история возвратов денег и журнал аудита платежей: один моргнувший запрос
 * стирал бухгалтерию, ничего никому не сказав.
 *
 * КОНТРОЛЬ ПРИБОРА обязателен и он здесь двойной: каждая проверка отказа
 * имеет пару «то же самое на рабочем KV». Без неё тест доказывал бы только
 * то, что при сломанном fetch что-то ломается, — а это и так известно.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  kvGet,
  kvGetChecked,
  kvSet,
  kvList,
  kvPush,
  kvScan,
  kvBackend,
  kvDegradedSince,
  __resetKvDegradedForTests,
} from "../api/payments/v1/_persist";

const KEY = "audit.v1";

/** Что реально ушло в KV за тест: сюда пишет поддельный fetch. */
let calls: string[] = [];
/** Содержимое поддельного KV: ключ → сериализованное значение. */
let store: Map<string, string>;
/** Когда true — любой запрос к KV отказывает. */
let broken = false;

function fakeFetch(url: string): Promise<Response> {
  // Путь вида {base}/{op}/{key}[/{body}] — так его собирает kvFetch.
  const rest = url.replace("https://kv.example/", "");
  const parts = rest.split("/").map(decodeURIComponent);
  const [op, key] = parts;
  calls.push(`${op} ${key ?? ""}`.trim());

  if (broken) {
    return Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as Response);
  }
  if (op === "get") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ result: store.get(key) ?? null }),
    } as Response);
  }
  if (op === "set") {
    store.set(key, parts.slice(2).join("/"));
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ result: "OK" }) } as Response);
  }
  if (op === "del") {
    store.delete(key);
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ result: 1 }) } as Response);
  }
  if (op === "scan") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ result: ["0", [...store.keys()]] }),
    } as Response);
  }
  return Promise.resolve({ ok: false, status: 400, json: async () => ({}) } as Response);
}

beforeEach(() => {
  process.env.KV_REST_API_URL = "https://kv.example";
  process.env.KV_REST_API_TOKEN = "t0ken";
  calls = [];
  store = new Map();
  broken = false;
  __resetKvDegradedForTests();
  // memMap живёт в globalThis и переживает импорты между файлами тестов.
  // ЧИСТИТЬ, А НЕ ПОДМЕНЯТЬ: модуль захватывает ссылку на Map один раз при
  // импорте, поэтому присваивание нового Map в globalThis он не увидит и
  // состояние потечёт между тестами. Первая версия этого файла так и делала,
  // и два теста падали по чужому мусору, а не по своему предмету.
  (
    globalThis as unknown as { __aevionPayKv?: Map<string, string> }
  ).__aevionPayKv?.clear();
  vi.stubGlobal("fetch", ((input: RequestInfo | URL) => fakeFetch(String(input))) as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

describe("хранилище платежей: отказ виден и ничего не стирает", () => {
  it("КОНТРОЛЬ: на рабочем KV всё как прежде — пишем, читаем, обещаем долговечность", async () => {
    await kvPush(KEY, { id: "a" });
    await kvPush(KEY, { id: "b" });
    expect(await kvList<{ id: string }>(KEY)).toEqual([{ id: "b" }, { id: "a" }]);
    expect(kvBackend()).toBe("kv");
    expect(kvDegradedSince()).toBeNull();
  });

  it("упавшее чтение НЕ стирает накопленный журнал", async () => {
    await kvPush(KEY, { id: "старая-1" });
    await kvPush(KEY, { id: "старая-2" });
    const было = store.get(KEY);
    expect(было, "контроль: журнал должен быть непустым до сбоя").toBeTruthy();

    broken = true;
    calls = [];
    await kvPush(KEY, { id: "новая" });

    // Главное утверждение: команды записи не было вовсе. Проверяем ВЫЗОВ, а
    // не итоговое значение: подделка при broken ничего не меняет, поэтому
    // сравнение содержимого прошло бы и на сломанном коде.
    expect(calls.filter((c) => c.startsWith("set")), "записал поверх непрочитанного").toEqual([]);
    expect(store.get(KEY), "журнал изменился").toBe(было);
  });

  it("запись, не доехавшая до KV, не пропадает — её видно в списке", async () => {
    await kvPush(KEY, { id: "старая" });
    broken = true;
    await kvPush(KEY, { id: "новая" });

    broken = false; // KV снова отвечает
    const list = await kvList<{ id: string }>(KEY);
    expect(list, "отложенная запись потерялась").toEqual([{ id: "новая" }, { id: "старая" }]);
  });

  it("после отказа обещаем память, а не долговечность — хотя переменные на месте", async () => {
    expect(kvBackend(), "контроль: до сбоя обещаем kv").toBe("kv");
    broken = true;
    await kvGet(KEY);
    expect(kvBackend(), "после отказа KV всё ещё обещаем долговечность").toBe("memory");
    expect(kvDegradedSince()?.op, "не записан повод деградации").toContain("get");
  });

  it("деградация — защёлка: вернувшийся KV не возвращает обещание", async () => {
    broken = true;
    await kvGet(KEY);
    broken = false;
    await kvGet(KEY);
    // Записи, уехавшие в память, там и остались; обещать «навсегда» уже нельзя.
    expect(kvBackend()).toBe("memory");
  });

  it("«не смог прочитать» отличимо от «такого ключа нет»", async () => {
    const нет = await kvGetChecked(KEY);
    expect(нет, "контроль: отсутствующий ключ — это успешное чтение").toEqual({
      ok: true,
      value: null,
    });
    broken = true;
    expect(await kvGetChecked(KEY)).toEqual({ ok: false });
  });

  it("пустой список из scan отличим от «не смог спросить»", async () => {
    const пусто = await kvScan("link:");
    expect(пусто.ok, "контроль: пустой KV — это успешный ответ").toBe(true);
    broken = true;
    const отказ = await kvScan("link:");
    expect(отказ.items).toEqual([]);
    expect(отказ.ok, "отказ scan неотличим от пустого результата").toBe(false);
  });

  it("отказ записи оставляет след в журнале процесса", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    broken = true;
    await kvSet(KEY, { id: "x" });
    expect(err, "молчаливый откат в память — узнать о нём неоткуда").toHaveBeenCalled();
    expect(String(err.mock.calls[0]?.[0]), "след не называет операцию").toContain("set");
    err.mockRestore();
  });

  it("не-список под ключом журнала не роняет запрос и не затирается", async () => {
    // Нашлось собственным прогоном: kvPush звал .unshift на том, что прочитал,
    // а в refunds/route.ts он вызывается без перехвата — возврат денег ответил
    // бы 500 уже ПОСЛЕ того, как возврат посчитан.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    store.set(KEY, JSON.stringify({ id: "не-список" }));
    await expect(kvPush(KEY, { id: "новая" })).resolves.toBeUndefined();
    expect(store.get(KEY), "испорченное значение затёрли").toBe(
      JSON.stringify({ id: "не-список" }),
    );
    expect(kvBackend(), "молча продолжили обещать долговечность").toBe("memory");
    err.mockRestore();
  });

  it("очередь вебхуков не стирается, когда её не удалось прочитать", async () => {
    // Тот же класс, но собранный вручную в другом файле: раньше здесь было
    // «прочитать очередь → добавить → записать обратно», и упавшее чтение
    // уничтожало все ожидающие доставки.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { enqueueAttempt } = await import("../api/payments/v1/_webhook_queue");
    const opts = {
      webhook_id: "wh_1",
      webhook_url: "https://example.test/hook",
      webhook_secret: "s",
      event: "payment.succeeded",
      payload: "{}",
    };
    await enqueueAttempt(opts);
    await enqueueAttempt(opts);
    const было = store.get("webhook.queue.v1");
    expect(JSON.parse(было ?? "[]"), "контроль: две попытки должны лежать в очереди").toHaveLength(2);

    broken = true;
    calls = [];
    await enqueueAttempt(opts);
    expect(calls.filter((c) => c.startsWith("set")), "перезаписал непрочитанную очередь").toEqual([]);
    expect(store.get("webhook.queue.v1")).toBe(было);
    err.mockRestore();
  });

  it("обработка очереди при нечитаемом хранилище не отчитывается «пусто»", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { processDue } = await import("../api/payments/v1/_webhook_queue");

    const пусто = await processDue();
    expect(пусто.scanned, "контроль: на рабочем KV пустая очередь — это 0").toBe(0);
    expect(пусто.unread, "контроль: рабочее чтение не должно помечаться нечитаемым").toBeFalsy();

    broken = true;
    const отказ = await processDue();
    // Нули те же — различает только признак. Без него вызывающий увидит
    // scanned: 0 и решит, что доставлять было нечего.
    expect(отказ.scanned).toBe(0);
    expect(отказ.unread, "отказ чтения неотличим от пустой очереди").toBe(true);
    err.mockRestore();
  });

  it("без переменных окружения — по-прежнему честная память", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    expect(kvBackend()).toBe("memory");
    await kvPush(KEY, { id: "m" });
    expect(await kvList(KEY)).toEqual([{ id: "m" }]);
    expect(calls, "ходили в сеть при ненастроенном KV").toEqual([]);
  });
});
