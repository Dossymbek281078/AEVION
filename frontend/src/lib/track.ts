import { apiUrl } from "./apiBase";
import { channelNow } from "./channelNow";


/**
 * Лёгкий analytics-трекер для GTM-страниц.
 * Без cookies, без fingerprinting — только sessionStorage sid и body event.
 *
 * Использует navigator.sendBeacon когда возможно — гарантирует доставку
 * даже при unload (клик "Купить" → redirect → fetch отменяется в обычном
 * случае, beacon — нет).
 */

const SID_KEY = "aevion_gtm_sid";

export type EventType =
  | "page_view"
  | "cta_click"
  | "calculator_open"
  | "calculator_quote"
  | "checkout_start"
  | "checkout_success"
  | "checkout_cancel"
  | "lead_submit"
  | "tier_view"
  | "industry_view"
  | "faq_open"
  | "comparison_view"
  | "affiliate_apply"
  | "partner_apply"
  | "edu_apply"
  | "ab_assigned";

export interface TrackPayload {
  type: EventType;
  source?: string;
  tier?: string;
  industry?: string;
  value?: number;
  meta?: Record<string, string | number | boolean | null>;
}

function getSid(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

export function track(payload: TrackPayload): void {
  if (typeof window === "undefined") return;

  // Метка канала приезжает в meta, и сводка воронки читает ТОЛЬКО её: поле
  // path рядом тоже несёт ?c=, но никто его не разбирает — и правильно, туда
  // может прийти что угодно.
  //
  // Найдено 30.08.2026: из десяти мест, шлющих начало оплаты, метку клали два.
  // Восемь остальных — страницы модулей, витрина, тарифы, посадочные под
  // ролики — сообщали «начали платить», не говоря откуда пришёл человек.
  // Чинится здесь, в единственной точке, через которую проходят все события:
  // восемь одинаковых правок были бы восемью копиями одного механизма, и
  // девятое место снова родилось бы без метки.
  //
  // Если отправитель метку передал — она старше: серверная страница читает ?c=
  // надёжнее, чем мы здесь по адресу в браузере.
  const givenChannel = payload.meta?.channel;

  const channel = channelNow();
  const meta =
    givenChannel || !channel ? payload.meta : { ...(payload.meta ?? {}), channel };

  /*
   * Оповещаем страницу о событии — этим пользуются рекламные счётчики.
   *
   * Найдено 31.08.2026: счётчик Meta/TikTok ловил только клики по ССЫЛКАМ в
   * кассу. А три главных пути оплаты — таблица тарифов, чип модуля и кнопка
   * апселла — это КНОПКИ: адрес они получают от бэкенда и уходят по нему
   * скриптом. То есть при включённой рекламе покупки с самой посещаемой
   * денежной страницы до площадки бы не дошли, а площадка учится именно на
   * этих событиях.
   *
   * Событие идёт через window, а не прямым вызовом счётчика: учёт не должен
   * знать про рекламу. Кто хочет — подписывается.
   */
  try {
    window.dispatchEvent(new CustomEvent("aevion:track", { detail: { ...payload, meta } }));
  } catch {
    // Оповещение не должно ломать сам замер: если CustomEvent недоступен,
    // событие всё равно уйдёт на сервер строкой ниже.
  }

  const body = JSON.stringify({
    ...payload,
    ...(meta ? { meta } : {}),
    sid: getSid(),
    path: window.location.pathname + window.location.search,
  });

  const url = apiUrl("/api/pricing/events");

  // sendBeacon — лучший выбор: переживёт unload, не блокирует UI
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch {
      // fall through to fetch
    }
  }

  // Fallback: fire-and-forget fetch с keepalive
  try {
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Аналитика не должна ломать UX — глотаем
    });
  } catch {
    // ignore
  }
}
