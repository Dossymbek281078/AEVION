"use client";

import type { CSSProperties, ReactNode } from "react";
import { track } from "@/lib/track";
import { channelFrom } from "@/lib/products";

/**
 * Ссылка на оплату, которая сама сообщает воронке о намерении купить.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ. Витрины `/shop` и `/go` — серверные компоненты:
 * повесить onClick прямо на <a> там нельзя, а `track()` живёт в браузере.
 * Раньше это заканчивалось тем, что покупки с витрин просто не попадали в
 * `/pricing/admin` — дашборд показывал заниженное число и выглядел при этом
 * достоверно. Обёртка решает это одним способом для всех страниц сразу,
 * вместо четырёх копий одинакового якоря.
 *
 * Событие уходит через `navigator.sendBeacon` (см. lib/track), поэтому
 * переживает переход на сайт платёжной системы.
 */
export function BuyLink({
  href,
  source,
  productId,
  priceUsd,
  channel,
  style,
  children,
  className,
}: {
  href: string;
  /** Откуда именно нажали — попадает в разбивку дашборда. */
  source: string;
  /** id позиции каталога, чтобы связать покупку с товаром. */
  productId?: string;
  priceUsd?: number;
  /** Канал привлечения из `?c=` — связывает покупку с источником трафика. */
  channel?: string | null;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      className={className}
      onClick={() => {
        // Метку канала обычно передаёт серверная страница: она читает ?c= из
        // адреса и отдаёт сюда готовой. Но так делают не все — /qrenew, куда
        // ведут ролики, кнопку рисует из клиентского компонента и передать
        // метку не может. Тогда берём её сами, здесь: на клике window уже
        // есть, и SSR это не ломает.
        //
        // Запасной путь ниже прежнего по старшинству: если страница метку
        // передала, берётся она. Два источника одного значения — та ещё
        // затея, поэтому старшинство названо явно, а не выведено из порядка.
        const fromUrl =
          typeof window === "undefined"
            ? null
            : channelFrom(new URLSearchParams(window.location.search).get("c") ?? undefined);
        const mark = channel ?? fromUrl;
        track({
          type: "checkout_start",
          source,
          value: priceUsd,
          meta: {
            ...(productId ? { product: productId } : {}),
            ...(mark ? { channel: mark } : {}),
          },
        });
      }}
    >
      {children}
    </a>
  );
}
