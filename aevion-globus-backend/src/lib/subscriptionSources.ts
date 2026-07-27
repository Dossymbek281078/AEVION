/**
 * Разрез подписок по источнику трафика.
 *
 * Отвечает на тот же вопрос, что `bySource` для заказов Gumroad — «какой канал
 * окупается» — но для подписок, которые продаются через LemonSqueezy: DevHub,
 * Smeta, QVenture, Bureau, QPayNet, CyberChess, QContract. Метка попадает в
 * запись подписки из `checkout[custom][channel]` (см. lemonSqueezyWebhook).
 *
 * ПОЧЕМУ ТОЛЬКО КОЛИЧЕСТВО, БЕЗ ДЕНЕГ. Вебхук LemonSqueezy не сохраняет сумму
 * в запись подписки — там есть тариф, но не `amountUsd`. Посчитать выручку по
 * каналу можно было бы, домножив тариф на цену из каталога, но это была бы
 * оценка, выданная за факт: цена на чекауте отличается от каталожной при
 * скидке, промокоде и годовом периоде. Отдаём то, что знаем точно — сколько
 * подписок пришло с какого канала, — и не притворяемся, что знаем сумму.
 *
 * Записи о даунгрейде (tierId "free", их пишет вебхук на отмену) в счёт не
 * идут: это не приход, а уход, и складывать их с покупками значит завышать
 * результат канала.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { isInternalPurchase } from "../routes/revenue";
import type { Subscription } from "../routes/provisioning";

/** Путь читается при вызове — та же причина, что в provisioning.ts. */
function subsFile(): string {
  return process.env.SUBSCRIPTIONS_FILE || join(process.cwd(), "data", "subscriptions.jsonl");
}

export interface SubscriptionSourceRow {
  /** Сколько подписок пришло с этого канала. */
  count: number;
  /** Разбивка по тарифам — «десять lite» и «десять full» это разные новости. */
  byTier: Record<string, number>;
}

export interface SubscriptionSources {
  bySource: Record<string, SubscriptionSourceRow>;
  /** Всего учтённых подписок — чтобы доли можно было считать, не суммируя заново. */
  total: number;
  /**
   * Сколько записей отброшено и почему. Без этого «мало данных» и «много
   * отфильтровано» выглядят одинаково.
   */
  skipped: { internal: number; downgrade: number; malformed: number };
}

export function aggregateSubscriptionSources(subs: Subscription[]): SubscriptionSources {
  const bySource: Record<string, SubscriptionSourceRow> = {};
  const skipped = { internal: 0, downgrade: 0, malformed: 0 };
  let total = 0;

  for (const s of subs) {
    if (!s || typeof s !== "object") {
      skipped.malformed++;
      continue;
    }
    if (s.tierId === "free") {
      skipped.downgrade++;
      continue;
    }
    if (isInternalPurchase(s.email)) {
      skipped.internal++;
      continue;
    }
    // Подписки без метки собираются в "unattributed", а не выбрасываются:
    // молча терять часть из сводки хуже, чем честно показать неразмеченное.
    const src = s.channel || "unattributed";
    if (!bySource[src]) bySource[src] = { count: 0, byTier: {} };
    bySource[src].count++;
    bySource[src].byTier[s.tierId] = (bySource[src].byTier[s.tierId] ?? 0) + 1;
    total++;
  }

  return { bySource, total, skipped };
}

/** Читает хранилище подписок целиком. Битые строки пропускаются, а не роняют ответ. */
export function readSubscriptions(): { subs: Subscription[]; malformed: number } {
  const file = subsFile();
  if (!existsSync(file)) return { subs: [], malformed: 0 };
  const subs: Subscription[] = [];
  let malformed = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      subs.push(JSON.parse(t) as Subscription);
    } catch {
      malformed++;
    }
  }
  return { subs, malformed };
}
