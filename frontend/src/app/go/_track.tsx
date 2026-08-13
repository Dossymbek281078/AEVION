"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

/**
 * Замер на странице-хабе `/go` — той, что стоит ссылкой в шапке профиля.
 *
 * Зачем. 13.08.2026: у `/go` не было замера ВООБЩЕ. Двенадцать роликов готовы к
 * публикации, ссылка в шапке ведёт сюда — и после раздачи нельзя было бы
 * ответить даже на первый вопрос: приходил ли кто-нибудь. Продажа — слишком
 * поздний и слишком редкий сигнал, чтобы по нему судить о раздаче.
 *
 * Приём событий на проде живой (`POST /api/pricing/events` → 204), сводка
 * закрыта авторизацией. То есть инфраструктура была, страница просто не была к
 * ней подключена.
 *
 * Клики по внешним ссылкам ловим делегированием на документе, а не
 * переписыванием карточек в клиентские компоненты: страница серверная, и
 * ломать это ради замера незачем. `track` уходит через sendBeacon, поэтому
 * событие переживает переход на чекаут — обычный fetch на unload отменяется.
 */
export function GoPageTracking({ channel }: { channel: string | null }) {
  const sentPageView = useRef(false);

  useEffect(() => {
    // В dev React вызывает эффект дважды — без защёлки в сводке был бы
    // двойной счёт посещений, то есть завышенная цифра на пустом месте.
    if (!sentPageView.current) {
      sentPageView.current = true;
      track({ type: "page_view", source: "go", meta: { channel: channel ?? "direct" } });
    }

    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      // Считаем только уходы к оплате: внутренние переходы меряются на своих
      // страницах, и смешивать их здесь значило бы завысить намерение купить.
      if (!/gumroad\.com|lemonsqueezy\.com/.test(href)) return;
      const product = href.match(/\/l\/([a-zA-Z0-9]+)/)?.[1]
        ?? href.match(/checkout\/buy\/([a-f0-9-]+)/)?.[1]
        ?? "unknown";
      track({
        type: "cta_click",
        source: "go",
        meta: { channel: channel ?? "direct", product },
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [channel]);

  return null;
}
