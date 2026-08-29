import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Путь к журналу событий должен читаться ПРИ ВЫЗОВЕ, а не при импорте модуля.
//
// Раньше это была константа уровня модуля. Тест, выставляющий EVENTS_FILE во
// временную папку, ничего не менял, если модуль к тому моменту уже импортирован
// (пусть и транзитивно, через другой роутер) — и события уезжали в РЕАЛЬНЫЙ
// data/events.jsonl, переживая прогон. Именно эта форма ошибки уже доказана на
// provisioning.ts и числится среди причин order-dependent падений (issue #982).
//
// Ключевой момент теста: модуль импортируется ДО того, как выставлена
// переменная окружения. Импорт после установки прошёл бы и со старым кодом,
// то есть ничего бы не проверял.
import {
  eventsStoreStatus,
  __resetEventsStoreStatusCache,
} from "../src/routes/events";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "events-path-test-"));
  __resetEventsStoreStatusCache();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.EVENTS_FILE;
  __resetEventsStoreStatusCache();
});

describe("путь к журналу событий читается при вызове", () => {
  test("переменная, выставленная после импорта модуля, всё равно действует", () => {
    const file = path.join(dir, "events.jsonl");
    writeFileSync(file, JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", type: "page_view" }) + "\n", "utf8");

    process.env.EVENTS_FILE = file;
    __resetEventsStoreStatusCache();

    const st = eventsStoreStatus();
    expect(st.persistedByEnv).toBe(true);
    expect(st.exists).toBe(true);
    expect(st.count).toBe(1);
    expect(st.oldest).toBe("2026-01-01T00:00:00.000Z");
  });

  test("без переменной статус честно говорит, что путь дефолтный", () => {
    delete process.env.EVENTS_FILE;
    __resetEventsStoreStatusCache();
    expect(eventsStoreStatus().persistedByEnv).toBe(false);
  });

  test("смена переменной между вызовами меняет то, что читается", () => {
    const a = path.join(dir, "a.jsonl");
    const b = path.join(dir, "b.jsonl");
    writeFileSync(a, JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", type: "page_view" }) + "\n", "utf8");
    writeFileSync(
      b,
      [
        JSON.stringify({ ts: "2026-02-01T00:00:00.000Z", type: "page_view" }),
        JSON.stringify({ ts: "2026-03-01T00:00:00.000Z", type: "cta_click" }),
      ].join("\n") + "\n",
      "utf8",
    );

    process.env.EVENTS_FILE = a;
    __resetEventsStoreStatusCache();
    expect(eventsStoreStatus().count).toBe(1);

    process.env.EVENTS_FILE = b;
    __resetEventsStoreStatusCache();
    expect(eventsStoreStatus().count).toBe(2);
  });

  test("признак persistedByEnv описывает тот же путь, который прочитан", () => {
    // Инвариант из исходного комментария: разнесённые чтения env позволяли бы
    // статусу сказать «persisted», пока путь остаётся дефолтным.
    const file = path.join(dir, "events.jsonl");
    writeFileSync(file, "", "utf8");
    process.env.EVENTS_FILE = file;
    __resetEventsStoreStatusCache();

    const st = eventsStoreStatus();
    expect(st.persistedByEnv).toBe(true);
    expect(st.exists).toBe(true); // именно этот файл, а не дефолтный
    expect(st.count).toBe(0);
  });
});
