"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * Честная строка о том, чем можно заплатить.
 *
 * ЗАЧЕМ. Замер 29.08.2026: настроены только те провайдеры, что берут карты
 * через Stripe. Карты РФ там не проходят — это записано ещё 14.08 замером из
 * Астаны. При этом НИ ОДНА страница воронки об этом не предупреждала, хотя
 * /pricing умеет: там ответ ручки состояния решает, какую подпись показать.
 * Человек доходил до кассы и упирался в стену молча.
 *
 * ПОЧЕМУ КЛИЕНТСКИЙ. Первая попытка спрашивала состояние на СЕРВЕРЕ — и не
 * сработала: `apiUrl` там резолвится через внутренние переменные окружения, и
 * в сборке это не тот адрес. Подпись не появилась вовсе, правку пришлось
 * откатить. Из браузера адрес публичный и верный — так же, как на /pricing.
 *
 * ТРИ СОСТОЯНИЯ, А НЕ ДВА. Пока не ответили — молчим: утверждать про чужие
 * карты, не проверив, хуже, чем не сказать ничего. И когда PayBox настроят,
 * строка исчезнет сама — безусловная подпись врала бы в другую сторону и
 * отпугивала платящих.
 */
/**
 * Тексты по языкам.
 *
 * Заведено 31.08.2026. До этого текст был один и русский, поэтому на /en/go и
 * /en/longevity компонент поставить было нельзя: предупреждение появилось бы
 * по-русски посреди английской страницы — тот самый класс «объявленный язык
 * не совпадает с содержимым», который мы у себя же чиним. Обе страницы
 * продавали молча только из-за этого.
 *
 * Форма взята у WaitlistCapture (`lang?: "ru" | "en"` + карта COPY): она уже
 * стоит на обеих половинах воронки, и второй способ локализации здесь заводить
 * незачем.
 */
const COPY = {
  ru: "Оплата картой через международные платёжные системы. Карты, выпущенные в "
    + "России, там не проходят — оплата в тенге и местными картами пока недоступна.",
  en: "Payment is taken by card through international payment systems. Cards issued "
    + "in Russia are not accepted, and payment in tenge or with local cards is not "
    + "available yet.",
} as const;

export function PaymentReachNotice({
  style,
  lang = "ru",
}: {
  style?: React.CSSProperties;
  lang?: "ru" | "en";
}) {
  const [kztReady, setKztReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/pricing/checkout/healthz"), {
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setKztReady(Boolean(j?.providers?.paybox?.configured));
      } catch {
        // Состояние неизвестно — строки не будет. Страницу это не ломает.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (kztReady !== false) return null;

  return (
    <p style={style}>{COPY[lang]}</p>
  );
}
