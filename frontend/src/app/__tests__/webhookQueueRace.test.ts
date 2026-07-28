import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueAttempt,
  processDue,
  queueStats,
  readQueue,
} from "../api/payments/v1/_webhook_queue";
import { kvSet } from "../api/payments/v1/_persist";

/**
 * Очередь вебхуков читалась целиком, обрабатывалась (сетевые запросы!) и целиком
 * записывалась обратно. Отсюда два дефекта, оба тихие:
 *
 * 1. **Попытка, добавленная во время прохода, ЗАТИРАЛАСЬ.** `processDue` в конце
 *    писал снимок, прочитанный ДО доставки; всё, что появилось за это время,
 *    исчезало. Вебхук молча не уходил никогда — а окно тут не микроскопическое,
 *    это время реальных HTTP-запросов, до двадцати штук подряд.
 * 2. **Два одновременных прохода брали одни и те же попытки** и слали вебхук
 *    ДВАЖДЫ: оба читали один список pending.
 */

const QUEUE_KEY = "webhook.queue.v1";

function attempt(event: string) {
  return {
    webhook_id: "wh_test",
    webhook_url: "https://example.com/hook",
    webhook_secret: "whsec_test",
    event,
    payload: JSON.stringify({ event }),
  };
}

describe("очередь вебхуков: без дублей и без потерь", () => {
  beforeEach(async () => {
    await kvSet(QUEUE_KEY, []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("событие, добавленное во время доставки, не пропадает", async () => {
    await enqueueAttempt(attempt("payment.succeeded"));

    // Доставка медленная — ровно в это окно и терялись новые события.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await enqueueAttempt(attempt("refund.issued"));
        return new Response("ok", { status: 200 });
      }),
    );

    await processDue();

    const queue = await readQueue();
    const events = queue.map((a) => a.event).sort();
    expect(events).toEqual(["payment.succeeded", "refund.issued"]);
  });

  it("два одновременных прохода не отправляют один вебхук дважды", async () => {
    await enqueueAttempt(attempt("payment.succeeded"));

    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return new Response("ok", { status: 200 });
      }),
    );

    await Promise.all([processDue(), processDue()]);

    expect(calls).toBe(1);
    const queue = await readQueue();
    expect(queue.filter((a) => a.status === "delivered").length).toBe(1);
  });

  it("взятые в работу попытки не пропадают из счётчика очереди", async () => {
    await enqueueAttempt(attempt("payment.succeeded"));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        // пока идёт доставка, попытка в состоянии in_flight
        const stats = await queueStats();
        expect(stats.pending).toBe(1);
        return new Response("ok", { status: 200 });
      }),
    );

    await processDue();
    const after = await queueStats();
    expect(after.delivered).toBe(1);
    expect(after.pending).toBe(0);
  });

  /**
   * Повторы здесь не исключение, а норма: шесть попыток с нарастающей паузой
   * плюс возврат зависшей попытки в работу. Без стабильного идентификатора
   * доставки получатель обязан считать каждый вызов новым событием — то есть
   * повторно провести оплату у себя. Заголовок должен быть ОДИН И ТОТ ЖЕ на
   * всех повторах одной доставки, а номер попытки — расти.
   */
  it("повтор несёт тот же идентификатор доставки и растущий номер попытки", async () => {
    await enqueueAttempt(attempt("payment.succeeded"));

    const seen: { delivery: string; attempt: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const h = init.headers as Record<string, string>;
        seen.push({ delivery: h["x-aevion-delivery"], attempt: h["x-aevion-attempt"] });
        return new Response("no", { status: 500 });
      }),
    );

    await processDue();
    // вторая попытка станет доступной только после паузы — двигаем срок вручную
    const q = await readQueue();
    q[0].next_retry_at = Date.now() - 1;
    await kvSet(QUEUE_KEY, q);
    await processDue();

    expect(seen).toHaveLength(2);
    expect(seen[0].delivery).toBeTruthy();
    expect(seen[1].delivery).toBe(seen[0].delivery); // тот же идентификатор
    expect(seen[0].attempt).toBe("1");
    expect(seen[1].attempt).toBe("2");
  });
});
