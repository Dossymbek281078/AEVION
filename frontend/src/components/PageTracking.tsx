"use client";

import { channelNow } from "@/lib/channelNow";
import { useEffect, useRef } from "react";
import { track } from "@/lib/track";
import { channelFrom } from "@/lib/products";

/**
 * Замер посещения и ухода к оплате — один компонент на все посадочные.
 *
 * Зачем. Замер 13.08.2026: из страниц, куда реально ведут ссылки, считала
 * только `/pricing`. Ролики на YouTube ведут на `/qrenew` и `/qmelanin` — там
 * не считалось НИЧЕГО. То есть даже те просмотры, что уже есть, приходили
 * вслепую: нельзя сказать ни сколько человек дошло, ни нажал ли кто-нибудь
 * «купить».
 *
 * Канал берём из адреса на клиенте (`?c=tt`), чтобы страницу не пришлось
 * делать серверной ради одной метки. Клики по оплате ловим делегированием на
 * документе: карточки остаются как есть, ничего не переписываем. `track` уходит
 * через sendBeacon, поэтому событие переживает переход на чекаут.
 *
 * Ставится одной строкой: <PageTracking page="qmelanin" />
 */
export function PageTracking({ page }: { page: string }) {
  const sent = useRef(false);

  useEffect(() => {
    // Метка приводится к тому же словарю, каким пользуются события оплаты.
    //
    // Найдено 30.08.2026: здесь метка клалась СЫРОЙ («tg»), а checkout_start —
    // сверенной по списку каналов («telegram»). В панели это две плитки, где
    // один и тот же канал назван двумя словами, и сопоставить заходы с
    // покупками нельзя. Сверка живёт в channelFrom, второй словарь заводить
    // здесь незачем.
    //
    // Три исхода различаются намеренно:
    //   метки нет      -> "direct"
    //   метка знакомая -> имя канала из списка
    //   метка чужая    -> "unknown", и это НЕ то же самое, что direct: именно
    //                     по росту этой доли 21.08 заметили, что для Дзена и
    //                     VK не заведены метки и продажи с них терялись.
    //                     Какая именно метка пришла, видно в поле path рядом.
    // Через общий источник: иначе просмотр после перехода без метки скажет
    // «прямой заход», а покупка в той же вкладке — «из TikTok». Два наших
    // ответа об одном человеке разошлись бы, и воронка перестала бы сходиться.
    const raw = new URLSearchParams(window.location.search).get("c");
    const известный = channelNow();
    const channel = известный ?? (raw ? "unknown" : "direct");

    // В dev React вызывает эффект дважды. Без защёлки сводка показывала бы
    // вдвое больше посещений на пустом месте.
    if (!sent.current) {
      sent.current = true;
      track({ type: "page_view", source: page, meta: { channel } });
    }

    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      // Только уходы к оплате. Внутренние переходы меряются на своих страницах;
      // считать их намерением купить значило бы завысить цифру.
      if (!/gumroad\.com|lemonsqueezy\.com/.test(href)) return;
      const product = href.match(/\/l\/([a-zA-Z0-9]+)/)?.[1]
        ?? href.match(/checkout\/buy\/([a-f0-9-]+)/)?.[1]
        ?? "unknown";
      track({ type: "cta_click", source: page, meta: { channel, product } });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [page]);

  return null;
}
