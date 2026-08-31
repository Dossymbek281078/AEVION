"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Пиксели рекламных кабинетов (Meta, TikTok).
 *
 * ЗАЧЕМ. Без пикселя рекламный кабинет умеет оптимизировать кампанию только по
 * кликам — то есть искать людей, которые любят нажимать, а не покупать. Разница
 * в цене привлечения между «оптимизация по кликам» и «по событию» — кратная, и
 * на бюджетах $7–10 в день это разница между «получили данные» и «слили».
 *
 * ГРАНИЦА, которую важно понимать. Оплата уходит на ЧУЖОЙ домен (Gumroad,
 * LemonSqueezy) — туда этот код не достаёт. Поэтому здесь ловится вся воронка
 * ДО чекаута:
 *   PageView          — заход на любую страницу;
 *   InitiateCheckout  — нажатие по ссылке оплаты, то есть уход на процессинг.
 * Само `Purchase` присылает Gumroad — у него в настройках продукта есть поле
 * для Facebook Pixel ID. Без этого поля кабинет увидит только намерение купить,
 * но не покупку. Это ручной шаг, он описан в
 * `AEVION-РЕКЛАМА-КАНАЛЫ\03-ПИКСЕЛИ-И-ССЫЛКИ\ПИКСЕЛЬ-установка.md`.
 *
 * ВЫКЛЮЧЕНО ПО УМОЛЧАНИЮ. Без переменной окружения компонент возвращает null
 * до рендера <Script>, а слушатель кликов выходит на первой строке: ни один
 * сторонний скрипт не загружается и ни одно событие не отправляется. Сам текст
 * сниппетов при этом остаётся в бандле мёртвым грузом — проверено на dev-сборке
 * 27.07.2026, `connect.facebook.net` присутствует в чанке и с пустым env. Это
 * несколько сотен байт и ноль сетевых запросов, а не «ничего в бандле».
 */

const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
const TIKTOK_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || "";

/** Домены платёжных процессингов — уход на них и есть начало оформления. */
const CHECKOUT_HOSTS = ["gumroad.com", "lemonsqueezy.com"];

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
  }
}

/**
 * Идентификатор товара из ссылки оплаты: `gumroad.com/l/oijxmq` → `oijxmq`,
 * `lemonsqueezy.com/checkout/buy/<uuid>` → `<uuid>`.
 *
 * Сознательно НЕ тянем сюда цену из каталога товаров: во-первых, это утащило
 * бы весь каталог в бандл каждой страницы; во-вторых, на чекауте цена может
 * отличаться от каталожной (скидка, промокод), и отправленная отсюда сумма
 * была бы неправдой. Фактическую сумму пришлёт Purchase со стороны Gumroad.
 */
function productIdFrom(href: string): string | undefined {
  try {
    const url = new URL(href);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || undefined;
  } catch {
    return undefined;
  }
}

function isCheckoutLink(href: string): boolean {
  try {
    const host = new URL(href).hostname;
    return CHECKOUT_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export function AdPixels() {
  const pathname = usePathname();
  // Первый PageView отправляет инициализирующий сниппет. Без этого флага
  // эффект ниже отправил бы его повторно на первой же загрузке, и весь трафик
  // в отчётах кабинета удвоился бы — с ним удвоилась бы и мнимая конверсия.
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
    window.ttq?.track("Browse");
  }, [pathname]);

  useEffect(() => {
    if (!META_ID && !TIKTOK_ID) return;
    // Делегирование на документе, а не обработчик на каждой кнопке: ссылки на
    // оплату разбросаны по /go, /shop, /apps и страницам модулей, и часть из
    // них — серверные компоненты. Один слушатель покрывает все и не требует
    // помнить о трекинге при добавлении следующей кнопки.
    // Один заход к оплате — одно событие площадке.
    //
    // Путей к кассе два вида, и раньше счётчик знал только первый:
    //   ссылка   <a href="…gumroad…"> — виден кликом;
    //   кнопка   таблица тарифов, чип модуля, апселл: адрес приходит от
    //            бэкенда, переход делает скрипт, клика по ссылке НЕТ.
    // Второй вид — самые посещаемые денежные страницы, и площадка на них бы
    // ничему не научилась.
    //
    // Теперь основной источник — наше собственное событие checkout_start: его
    // шлют все десять отправителей. Слушатель кликов оставлен для ссылок,
    // которые событие НЕ шлют (например, прямая ссылка на странице
    // конституции), и гасится флагом, чтобы один заход не посчитали дважды.
    let ужеОтправлено = false;
    const пометить = (id: string | null) => {
      window.fbq?.("track", "InitiateCheckout", id ? { content_ids: [id] } : undefined);
      window.ttq?.track("InitiateCheckout", id ? { content_id: id } : undefined);
    };

    const onTrack = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { type?: string; meta?: Record<string, unknown> }
        | undefined;
      if (!d || d.type !== "checkout_start") return;
      ужеОтправлено = true;
      // Флаг живёт один кадр: он гасит клик по ТОЙ ЖЕ ссылке, а не следующую
      // покупку. Без сброса второй заход в кассу остался бы неучтённым.
      setTimeout(() => {
        ужеОтправлено = false;
      }, 0);
      const id = typeof d.meta?.product === "string" ? d.meta.product : null;
      пометить(id);
    };

    const onClick = (e: MouseEvent) => {
      if (ужеОтправлено) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a");
      const href = link?.getAttribute("href");
      if (!href || !isCheckoutLink(href)) return;
      пометить(productIdFrom(href) ?? null);
    };

    window.addEventListener("aevion:track", onTrack);
    // Слушатель кликов — на всплытии, а не на перехвате: обработчик самой
    // ссылки успевает позвать track(), выставить флаг, и двойного счёта нет.
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("aevion:track", onTrack);
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (!META_ID && !TIKTOK_ID) return null;

  return (
    <>
      {META_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_ID}');fbq('track','PageView');`}
        </Script>
      )}
      {TIKTOK_ID && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";
o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];
a.parentNode.insertBefore(o,a)};
ttq.load('${TIKTOK_ID}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
    </>
  );
}
