"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { channelFrom } from "@/lib/products";

/**
 * Внутренняя ссылка, которая доносит метку канала до следующей страницы.
 *
 * Замер 31.08.2026 в браузере на /en/go?c=yt: из 29 внутренних ссылок метку
 * несла ОДНА — та, что написана в теле страницы. Остальные 28 приходят из общей
 * шапки и общего подвала, и метку теряют везде, где эти компоненты
 * отрисовываются. Человек приходит с ролика, жмёт «Pricing» в шапке — и любая
 * покупка после этого приходит в отчёт как пришедшая ниоткуда.
 *
 * Метка подставляется В МОМЕНТ КЛИКА, а не при отрисовке. Так сделано намеренно:
 * подвал — серверный компонент, на сервере адреса ещё нет, и подстановка при
 * отрисовке разошлась бы с разметкой клиента. На клике window уже есть, и
 * ссылка остаётся обычной ссылкой для поисковика — он видит адрес без хвоста,
 * а значит не заводит вариантов одной страницы.
 *
 * Значение сверяется по списку известных каналов: чужое ?c= из посторонней
 * ссылки дальше не поедет.
 */
export function KeepChannelLink({
  href,
  style,
  className,
  children,
}: {
  href: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  function keep(e: React.MouseEvent<HTMLAnchorElement>) {
    // Особые клики (новая вкладка, средняя кнопка) не перехватываем.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("c");
    const mark = channelFrom(raw ?? undefined);
    if (!mark || !raw) return;
    if (href.includes("c=")) return;
    e.preventDefault();
    const sep = href.includes("?") ? "&" : "?";
    window.location.href = `${href}${sep}c=${encodeURIComponent(raw)}`;
  }

  return (
    <Link href={href} style={style} className={className} onClick={keep}>
      {children}
    </Link>
  );
}
