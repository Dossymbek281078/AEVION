/**
 * Дедупликация платёжных вебхуков, переживающая перезапуск процесса.
 *
 * ЗАЧЕМ. Все четыре обработчика (PayPal, Paybox, Gumroad, LemonSqueezy) держали
 * ключи в обычном `new Set<string>()` в области модуля. Set пуст после каждого
 * рестарта, а репозиторий передеплоивается десятки раз в час. Все четыре
 * провайдера по своей документации повторяют доставку при таймауте или не-2xx,
 * и законный повтор, пришедший после передеплоя, проходил проверку заново:
 * сервер не помнил, что уже видел этот платёж.
 *
 * Последствие не гипотетическое: `provisionSubscription()` не ищет существующую
 * подписку по идентификатору платежа перед записью, поэтому повтор дописывал
 * ВТОРУЮ подписку в `data/subscriptions.jsonl` и слал покупателю второе
 * приветственное письмо.
 *
 * УСТРОЙСТВО. Тот же интерфейс, что у Set (`has` / `add` / `delete`), но с
 * журналом на диске. Формат — append-only jsonl, по строке на событие:
 *
 *   {"k":"gumroad:sale_123:paid","seen":true,"ts":"2026-07-27T06:00:00.000Z"}
 *   {"k":"gumroad:sale_123:paid","seen":false,"ts":"2026-07-27T06:00:01.000Z"}
 *
 * При чтении выигрывает последняя запись по ключу. `seen:false` — это надгробие
 * для случая, когда обработчик отклонил пинг и не должен занимать ключ (так
 * ведёт себя `SEEN.delete` в существующем коде: отклонённый пинг не мешает
 * прийти настоящему платежу с тем же идентификатором).
 *
 * Append-only, а не перезапись файла: параллельные процессы дописывают строки,
 * не затирая чужие, а история остаётся для разбора спорных списаний.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { dirname, join } from "path";

interface DedupRecord {
  k: string;
  seen: boolean;
  ts: string;
}

/**
 * Путь к журналу. Читается ПРИ ВЫЗОВЕ, а не при импорте модуля.
 *
 * Константа, вычисленная на импорте, дала бы ту же гонку «env против импорта»,
 * на которой уже обожглись в `provisioning.ts`: тест выставляет переменную
 * окружения, но модуль к тому моменту импортирован транзитивно и запомнил
 * дефолтный путь — и тестовые записи уезжают в реальный файл.
 */
function dedupFile(): string {
  return process.env.WEBHOOK_DEDUP_FILE || join(process.cwd(), "data", "webhook-dedup.jsonl");
}

/**
 * Кэш в памяти, чтобы не перечитывать файл на каждый вебхук. Ключ кэша — путь
 * к файлу: иначе тест, сменивший `WEBHOOK_DEDUP_FILE`, читал бы состояние,
 * загруженное для предыдущего файла, и «уже видели» срабатывало бы на пустом
 * журнале.
 */
const caches = new Map<string, Map<string, boolean>>();

function load(): Map<string, boolean> {
  const file = dedupFile();
  const cached = caches.get(file);
  if (cached) return cached;

  const state = new Map<string, boolean>();
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const rec = JSON.parse(trimmed) as DedupRecord;
        // Последняя запись по ключу выигрывает — журнал читается по порядку.
        if (rec && typeof rec.k === "string") state.set(rec.k, rec.seen !== false);
      } catch {
        // Битая строка не должна ронять приём платежей: пропускаем её.
        // Хуже потерять один ключ дедупа, чем перестать принимать вебхуки.
      }
    }
  }
  caches.set(file, state);
  return state;
}

function append(rec: DedupRecord): void {
  const file = dedupFile();
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify(rec) + "\n", "utf8");
  } catch (err) {
    // Диск недоступен — остаёмся с защитой в памяти, как было до этого модуля.
    // Ронять обработчик платежа из-за журнала нельзя: покупатель уже заплатил.
    console.warn(`[webhookDedup] не удалось записать журнал: ${(err as Error).message}`);
  }
}

/** Видели ли уже этот вебхук — с учётом того, что было до перезапуска. */
export function hasSeenWebhook(provider: string, key: string): boolean {
  return load().get(`${provider}:${key}`) === true;
}

/** Отметить вебхук обработанным. */
export function markWebhookSeen(provider: string, key: string): void {
  const k = `${provider}:${key}`;
  load().set(k, true);
  append({ k, seen: true, ts: new Date().toISOString() });
}

/**
 * Освободить ключ — обработчик отклонил пинг и тот не должен занимать место
 * настоящего платежа с тем же идентификатором.
 */
export function releaseWebhookKey(provider: string, key: string): void {
  const k = `${provider}:${key}`;
  load().set(k, false);
  append({ k, seen: false, ts: new Date().toISOString() });
}

/** Только для тестов: сбросить кэш, чтобы следующий вызов перечитал файл. */
export function __resetWebhookDedupCache(): void {
  caches.clear();
}
