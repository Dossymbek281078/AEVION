import { describe, it, expect } from "vitest";
import { capKeepingPending, __droppedPendingCount } from "../_webhook_queue";
import type { QueuedAttempt } from "../_webhook_queue";

/**
 * Сторож: из очереди вебхуков вытесняется СДЕЛАННОЕ, а не несделанное.
 *
 * ЗАЧЕМ. Раньше обрезка шла вслепую — kvPush и slice(0, CAP) выбрасывают
 * хвост, а хвост очереди это самые старые записи. Доставленные и
 * провалившиеся остаются в списке наравне с ожидающими, поэтому самые старые
 * здесь — ровно те доставки, которые ещё НЕ сделаны: попытка с растущей
 * паузой стареет и уходит в хвост. Под нагрузкой из очереди молча выпадала
 * несделанная работа, а сделанная занимала место. Снаружи всё выглядело
 * здоровым: длина в пределах, ошибок нет, счётчики на месте.
 */
const CAP = 1000;

function att(id: string, status: QueuedAttempt["status"]): QueuedAttempt {
  return {
    id,
    webhook_id: "wh_1",
    webhook_url: "https://merchant.example/hook",
    webhook_secret: "s",
    event: "payment.succeeded",
    payload: "{}",
    attempts: 1,
    next_retry_at: 0,
    last_attempt_at: null,
    last_error: null,
    last_http_code: null,
    status,
  } as QueuedAttempt;
}

describe("обрезка очереди не выбрасывает несделанные доставки", () => {
  it("старая ожидающая доставка переживает переполнение, а доставленная — нет", () => {
    // Список идёт новыми вперёд. Ожидающая — самая старая, то есть В ХВОСТЕ:
    // именно её и выбрасывала прежняя обрезка.
    const items = [
      att("att_new", "pending"),
      ...Array.from({ length: CAP - 1 }, (_, i) => att(`att_done_${i}`, "delivered")),
      att("att_old_pending", "pending"),
    ];
    expect(items.length).toBe(CAP + 1);

    const kept = capKeepingPending(items, CAP);

    expect(kept.length).toBe(CAP);
    expect(
      kept.some((a) => a.id === "att_old_pending"),
      "несделанную доставку выбросили, а сделанные оставили"
    ).toBe(true);
    // место освободилось за счёт САМОЙ СТАРОЙ завершённой
    expect(kept.some((a) => a.id === `att_done_${CAP - 2}`)).toBe(false);
    // порядок записей сохраняется
    expect(kept[0].id).toBe("att_new");
  });

  it("если ожидающих больше предела, потеря не проходит молча", () => {
    const было = __droppedPendingCount();
    const items = Array.from({ length: CAP + 3 }, (_, i) => att(`att_p_${i}`, "pending"));

    const kept = capKeepingPending(items, CAP);

    expect(kept.length).toBe(CAP);
    // Потеря доставки без следа неотличима от успеха: получатель ничего не
    // ждёт, а у нас пропадает обязательство. Счётчик обязан вырасти ровно на
    // число выброшенных.
    expect(__droppedPendingCount() - было).toBe(3);
  });
});
