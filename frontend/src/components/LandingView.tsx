"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Отметка просмотра посадочной. Клиентская обёртка на одну строку — сами
 * посадочные серверные (async-компоненты), а трекеру нужны sessionStorage и
 * sendBeacon.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ НОВЫЙ МЕХАНИЗМ. Замер 19.08.2026: трекер
 * `lib/track` живёт с мая, пишет в `/api/pricing/events`, у него есть отчёты
 * (summary, aggregate, recent, by-variant) и его зовут десять страниц —
 * acquire, apps, devhub, explore, весь раздел pricing. Не звали его ровно те
 * страницы, куда пойдёт трафик запуска: четыре посадочные и /go.
 *
 * Другую воронку (`useFunnel` → constitution) переиспользовать было нельзя:
 * её агрегация считает события по имени без разбивки и строит конверсию
 * page_view → slider_change. Просмотры посадочных раздули бы знаменатель и
 * сломали отчёт чужого модуля.
 *
 * `source` — метка канала: та же, что уходит с подпиской, поэтому «сколько
 * зашло» и «сколько подписалось» можно сопоставить по одному ключу.
 */
export function LandingView({ source }: { source: string }) {
  useEffect(() => {
    track({ type: "page_view", source });
  }, [source]);
  return null;
}
