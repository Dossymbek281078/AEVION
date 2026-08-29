"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/track";

/**
 * Отметка «покупка завершена» на странице, куда провайдер возвращает человека.
 *
 * Замер 29.08.2026. Адрес возврата у каждого провайдера свой, и только часть
 * из них ведёт на `/pricing/checkout/success`, где отметка уже стоит:
 *
 *   PayBox, PayPal → /pricing/checkout/success        ✅ считается
 *   Конституция    → /constitution?upgrade=success    ✅ своей воронкой
 *   Stripe         → /bureau?paid=1                   🔴 не считалось
 *   QPayNet        → /qpaynet/deposit/success         🔴 не считалось
 *
 * Деньги при этом не терялись: вебхуки провайдеров пишут покупку в базу
 * независимо от страницы. Не хватало другого — связи оплаты с каналом, из
 * которого пришёл человек. Без отметки реклама, ролик и рассылка выглядят
 * одинаково, и вопрос «что окупилось» остаётся без ответа.
 *
 * Компонент, а не копия `useEffect` на каждой странице: копия одного и того же
 * действия расходится молча, и разницу видно только при сравнении — тем же
 * вечером ровно так разошлась запись прав после оплаты в двух вебхуках.
 *
 * Отметка ставится ОДИН раз за монтирование: страницы возврата перерисовываются
 * (загрузка данных о платеже, смена языка), а повторное событие завысило бы
 * число продаж — то есть испортило бы именно ту цифру, ради которой всё и
 * делается.
 */
export function PurchaseReturnTracker({
  source,
  provider,
  successParam,
  successValue,
}: {
  /** Откуда пришли: попадает в воронку как источник. */
  source: string;
  /** Касса, вернувшая человека. */
  provider: string;
  /**
   * Параметр адреса, по которому видно УСПЕХ. Если не задан — сам факт
   * попадания на страницу считается успехом (так у /qpaynet/deposit/success).
   */
  successParam?: string;
  /** Значение параметра, означающее успех. По умолчанию "1". */
  successValue?: string;
}) {
  const params = useSearchParams();
  const fired = useRef(false);

  // Отказ страницы не должен зависеть от отметки, поэтому читаем всё мягко.
  const raw = successParam ? params.get(successParam) : null;
  const isSuccess = successParam ? raw === (successValue ?? "1") : true;

  useEffect(() => {
    if (!isSuccess || fired.current) return;
    fired.current = true;
    track({
      type: "checkout_success",
      source,
      meta: {
        provider,
        reference: params.get("reference"),
        checkoutId: params.get("cid"),
        stub: params.get("stub") === "1",
      },
    });
  }, [isSuccess, source, provider, params]);

  return null;
}

export default PurchaseReturnTracker;
