import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  hasSeenWebhook,
  markWebhookSeen,
  releaseWebhookKey,
  __resetWebhookDedupCache,
} from "../src/lib/webhookDedup";

// Дедуп платёжных вебхуков. Проверяется ровно то, чего не умел прежний
// in-memory Set: переживание перезапуска процесса. Провайдеры повторяют
// доставку при таймауте, репозиторий передеплоивается десятки раз в час, и
// повтор после передеплоя приводил ко второй подписке и второму приветственному
// письму одному покупателю.
//
// «Перезапуск» здесь — сброс кэша в памяти: после него единственный источник
// правды это файл журнала, то есть ровно то состояние, в котором стартует
// свежий процесс.

let dataDir: string;
let file: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "webhook-dedup-test-"));
  file = path.join(dataDir, "webhook-dedup.jsonl");
  process.env.WEBHOOK_DEDUP_FILE = file;
  __resetWebhookDedupCache();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.WEBHOOK_DEDUP_FILE;
  __resetWebhookDedupCache();
});

describe("дедуп вебхуков", () => {
  test("незнакомый вебхук не считается виденным", () => {
    expect(hasSeenWebhook("gumroad", "sale_1:paid")).toBe(false);
  });

  test("отмеченный вебхук виден в том же процессе", () => {
    markWebhookSeen("gumroad", "sale_1:paid");
    expect(hasSeenWebhook("gumroad", "sale_1:paid")).toBe(true);
  });

  test("отметка переживает перезапуск процесса", () => {
    markWebhookSeen("gumroad", "sale_1:paid");
    __resetWebhookDedupCache(); // ← процесс перезапустился, память пуста
    expect(hasSeenWebhook("gumroad", "sale_1:paid")).toBe(true);
  });

  test("освобождённый ключ снова свободен и после перезапуска", () => {
    markWebhookSeen("gumroad", "sale_1:paid");
    releaseWebhookKey("gumroad", "sale_1:paid");
    expect(hasSeenWebhook("gumroad", "sale_1:paid")).toBe(false);
    __resetWebhookDedupCache();
    expect(hasSeenWebhook("gumroad", "sale_1:paid")).toBe(false);
  });

  test("ключи не пересекаются между провайдерами", () => {
    markWebhookSeen("gumroad", "id_1:paid");
    __resetWebhookDedupCache();
    expect(hasSeenWebhook("paypal", "id_1:paid")).toBe(false);
    expect(hasSeenWebhook("gumroad", "id_1:paid")).toBe(true);
  });

  test("разные статусы одного платежа — разные ключи", () => {
    markWebhookSeen("gumroad", "sale_1:paid");
    __resetWebhookDedupCache();
    expect(hasSeenWebhook("gumroad", "sale_1:refunded")).toBe(false);
  });

  test("журнал только дописывается — история сохраняется", () => {
    markWebhookSeen("paybox", "p1:paid");
    releaseWebhookKey("paybox", "p1:paid");
    markWebhookSeen("paybox", "p1:paid");
    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    // Последняя запись по ключу выигрывает.
    __resetWebhookDedupCache();
    expect(hasSeenWebhook("paybox", "p1:paid")).toBe(true);
  });

  test("битая строка в журнале не роняет приём платежей", () => {
    markWebhookSeen("lemonsqueezy", "ls_1:created");
    // Обрыв записи на середине — реальный исход падения процесса при append.
    require("node:fs").appendFileSync(file, '{"k":"ls_2:created","se\n', "utf8");
    markWebhookSeen("lemonsqueezy", "ls_3:created");
    __resetWebhookDedupCache();
    expect(hasSeenWebhook("lemonsqueezy", "ls_1:created")).toBe(true);
    expect(hasSeenWebhook("lemonsqueezy", "ls_3:created")).toBe(true);
  });

  test("до первой записи файл не создаётся", () => {
    expect(hasSeenWebhook("paypal", "nothing:paid")).toBe(false);
    expect(existsSync(file)).toBe(false);
  });
});
