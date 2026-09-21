import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { leadsStoreStatus } from "../src/routes/pricing";

/**
 * Заявка со страницы «напишите нам» обязана лежать на ТОМЕ, а не в контейнере.
 *
 * ЗАЧЕМ. На 21.09.2026 четыре модуля запуска (qright, qsign, startup_exchange,
 * qskyway) не покупаются: касса отвечает 503 и отправляет человека на
 * `/pricing/contact`. Эта заявка — единственный след платящего человека.
 *
 * 🔴 А хранилась она по пути `process.cwd()/data/leads.jsonl`, то есть её
 * сохранность держалась на СОВПАДЕНИИ: том Railway смонтирован в
 * `/app/aevion-globus-backend/data`, и пока рабочий каталог ровно такой,
 * файл попадает на том случайно. Сменится каталог — заявки начнут стираться
 * каждой выкаткой, и заметить это нельзя: ручка отвечает 201, человек видит
 * «спасибо», файл исчезает вместе с контейнером.
 *
 * Сторож держит две вещи: путь берётся от ТОМА, а не от рабочего каталога, и
 * состояние отвечает фактом «под томом ли файл», а не «задана ли переменная» —
 * эту подмену уже разбирали 14.08 в events.ts и сделали из неё неверный вывод.
 */

const прежние = { ...process.env };

describe("хранилище заявок", () => {
  beforeEach(() => {
    delete process.env.LEADS_FILE;
    delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
  });
  afterEach(() => {
    process.env = { ...прежние };
  });

  test("том смонтирован -> файл под томом, даже если рабочий каталог другой", () => {
    process.env.RAILWAY_VOLUME_MOUNT_PATH = "/app/aevion-globus-backend/data";
    const s = leadsStoreStatus();
    expect(s.onVolume).toBe(true);
    // И это НЕ «переменная задана»: LEADS_FILE мы не ставили.
    expect(s.persistedByEnv).toBe(false);
  });

  test("явная переменная сильнее тома и честно помечается", () => {
    process.env.RAILWAY_VOLUME_MOUNT_PATH = "/app/aevion-globus-backend/data";
    process.env.LEADS_FILE = "/app/aevion-globus-backend/data/leads.jsonl";
    const s = leadsStoreStatus();
    expect(s.persistedByEnv).toBe(true);
    expect(s.onVolume).toBe(true);
  });

  test("🔴 контроль: путь ВНЕ тома обязан опознаваться как не на томе", () => {
    process.env.RAILWAY_VOLUME_MOUNT_PATH = "/app/aevion-globus-backend/data";
    process.env.LEADS_FILE = "/tmp/leads.jsonl";
    // Без этой проверки сторож был бы зелёным и на сломанном коде: «всегда
    // true» прошло бы два случая выше.
    expect(leadsStoreStatus().onVolume).toBe(false);
  });

  test("тома нет вовсе -> отвечаем «не знаю» (null), а не выдумываем «да»", () => {
    expect(leadsStoreStatus().onVolume).toBeNull();
  });
});
