import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * «Переживут ли события перезапись образа» — вопрос, на который /health отвечал
 * не то, что у него спрашивали.
 *
 * Поле persistedByEnv отвечает «задана ли переменная», а читается как
 * «сохранятся ли данные». 14.08.2026 я сам прочёл его именно так, написал
 * основателю тревогу «первая же сборка сотрёт весь замер» и просил настроить
 * переменную. Проверка в тот же день доказала обратное: 562 события с 26 мая
 * целы, потому что каталог лежит на смонтированном томе aevion-volume.
 *
 * Соседний вопрос — «какой коммит сейчас на проде» — решается НЕ здесь: ветка
 * fix/ratelimit-bucket-key пишет dist/build-info.json во время сборки и отдаёт
 * commit/branch/commitSource. Второй способ делать то же самое не заводим.
 */

async function statusWith(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Модуль читает env на верхнем уровне: статический импорт поднимается выше
  // присваивания, поэтому нужен свежий экземпляр.
  vi.resetModules();
  return await import("../src/routes/events");
}

beforeEach(() => {
  delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
  delete process.env.EVENTS_FILE;
});

describe("health отвечает на вопрос про сохранность честно", () => {
  test("файл под точкой монтирования тома — onVolume true", async () => {
    const mod = await statusWith({
      RAILWAY_VOLUME_MOUNT_PATH: "/app/data",
      EVENTS_FILE: "/app/data/events.jsonl",
    });

    expect(mod.eventsStoreStatus().onVolume).toBe(true);
  });

  test("файл ВНЕ тома — onVolume false, даже если переменная задана", async () => {
    // Именно этот случай и есть «сотрётся». Переменная при этом задана, то есть
    // persistedByEnv сказал бы true и успокоил бы зря.
    const mod = await statusWith({
      RAILWAY_VOLUME_MOUNT_PATH: "/app/data",
      EVENTS_FILE: "/tmp/events.jsonl",
    });

    const s = mod.eventsStoreStatus();
    expect(s.onVolume).toBe(false);
    expect(s.persistedByEnv).toBe(true);
  });

  test("тома нет в окружении — onVolume null, а не false", async () => {
    // «Не проверено» и «не сохранится» — разные ответы. Выдавать первое за
    // второе значит поднимать ложную тревогу, что 14.08 и произошло.
    const mod = await statusWith({
      RAILWAY_VOLUME_MOUNT_PATH: undefined,
      EVENTS_FILE: "/app/data/events.jsonl",
    });

    expect(mod.eventsStoreStatus().onVolume).toBeNull();
  });

  test("контроль: признак смотрит на ПУТЬ, а не на наличие переменной", async () => {
    const inside = await statusWith({
      RAILWAY_VOLUME_MOUNT_PATH: "/mnt/vol",
      EVENTS_FILE: "/mnt/vol/sub/events.jsonl",
    });
    expect(inside.eventsStoreStatus().onVolume).toBe(true);

    const outside = await statusWith({
      RAILWAY_VOLUME_MOUNT_PATH: "/mnt/vol",
      EVENTS_FILE: "/mnt/other/events.jsonl",
    });
    expect(outside.eventsStoreStatus().onVolume).toBe(false);
  });
});
