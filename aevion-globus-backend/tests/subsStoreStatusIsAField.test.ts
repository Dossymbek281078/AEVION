import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { subsStoreStatus, subsFile } from "../src/routes/provisioning";

/**
 * «Переживут ли записи о покупках выкатку» — это ПОЛЕ, а не рассуждение.
 *
 * ПОВОД (20.09.2026). В provisioning.ts лежал комментарий от 01.09: «SUBSCRIPTIONS_FILE
 * не задана, том подключён — файл В КОНТЕЙНЕРЕ». Читается однозначно: каждая выкатка
 * стирает оплаченный доступ. Я потратил на эту тревогу час — и она оказалась ложной:
 * путь по умолчанию ведёт в тот же каталог `data`, что и у событий, а про события
 * /health говорит onVolume: true при 10229 записях с 26 мая.
 *
 * Комментарий устарел молча, потому что он НЕ ПРОВЕРЯЕТСЯ ничем. Поле проверяется.
 */
const MOUNT = "RAILWAY_VOLUME_MOUNT_PATH";
let было: string | undefined;

beforeEach(() => { было = process.env[MOUNT]; });
afterEach(() => { if (было === undefined) delete process.env[MOUNT]; else process.env[MOUNT] = было; });

describe("subsStoreStatus отвечает фактом", () => {
  it("КОНТРОЛЬ: путь к файлу подписок вообще вычисляется", () => {
    expect(subsFile().length, "путь пуст — тест проверял бы пустоту").toBeGreaterThan(5);
  });

  it("том не задан → onVolume равен null, а НЕ false", () => {
    delete process.env[MOUNT];
    // null означает «не у кого спросить». false означал бы «спросили, не на томе» —
    // разные ответы, и путать их нельзя: из false следует ложная тревога.
    expect(subsStoreStatus().onVolume).toBeNull();
  });

  it("том совпадает с каталогом файла → onVolume true", () => {
    const dir = subsFile().split(String.fromCharCode(92)).join("/").replace(/\/[^/]+$/, "");
    process.env[MOUNT] = dir;
    expect(subsStoreStatus().onVolume, "путь под точкой монтирования, а поле говорит иное").toBe(true);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: чужая точка монтирования → onVolume false", () => {
    process.env[MOUNT] = "/sovsem-drugoy-tom-zzz";
    expect(subsStoreStatus().onVolume).toBe(false);
  });

  it("форма ответа та же, что у eventsStore", () => {
    const s = subsStoreStatus();
    expect(Object.keys(s).sort()).toEqual(["count", "exists", "oldest", "onVolume", "persistedByEnv"]);
  });
});
