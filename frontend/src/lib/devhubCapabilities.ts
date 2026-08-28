/**
 * Capability awareness for the DevHub IDE.
 *
 * `/api/devhub/studio/capabilities` already tells us honestly which
 * integrations are configured on the server ("live") and which are missing a
 * token ("needs_token"). The IDE never asked: the Vercel button looked
 * identical whether a deploy was possible or guaranteed to fail with 503.
 *
 * Deliberately FAIL-OPEN: a capability we have not loaded, or do not know, is
 * treated as available. A wrongly disabled button hides a working feature —
 * strictly worse than letting the honest server error through.
 */

export type Capability = {
  id: string;
  name?: string;
  status?: string;
  token?: string;
  tokens?: string[];
};

export type CapabilityIndex = Record<string, Capability>;

export function indexCapabilities(list: Capability[] | null | undefined): CapabilityIndex {
  const idx: CapabilityIndex = {};
  for (const c of list ?? []) {
    if (c && typeof c.id === "string") idx[c.id] = c;
  }
  return idx;
}

/** True only when the server explicitly reports this capability as not live. */
export function isCapabilityBlocked(idx: CapabilityIndex | null, id: string): boolean {
  const c = idx?.[id];
  if (!c || !c.status) return false; // unknown / not loaded yet → fail open
  return c.status !== "live";
}

/**
 * ПОДТВЕРЖДЕНА ли возможность. Не путать с isCapabilityBlocked.
 *
 * У двух вопросов разные правильные умолчания, и это не мелочь:
 *
 *   «блокировать ли кнопку?»  — на незнании НЕ блокируем (fail open):
 *                                иначе человек упрётся в мёртвую кнопку из-за
 *                                нашей незагруженной панели;
 *   «обещать ли вслух?»       — на незнании НЕ обещаем (fail closed):
 *                                обещание, которое через секунду исчезнет,
 *                                хуже отсутствия обещания.
 *
 * Замер 28.08.2026: обещание собственного домена *.aevion.build выводилось
 * через isCapabilityBlocked, то есть показывалось ДО загрузки возможностей —
 * а зона не делегирована, и адрес не открылся бы.
 */
export function isCapabilityConfirmed(idx: CapabilityIndex | null, id: string): boolean {
  return idx?.[id]?.status === "live";
}

/**
 * Объяснение для человека, который нажал недоступную кнопку.
 *
 * Раньше здесь возвращалось `"<label> is not configured — set VERCEL_API_TOKEN
 * on the server"`, и эта строка показывалась ПОКУПАТЕЛЮ в всплывающем
 * сообщении. Замер 28.08.2026: на проде `vercel` в состоянии `needs_token`, то
 * есть именно это видел каждый, кто нажимал кнопку выкатки в платном модуле.
 *
 * Три беды в одной строке: имя переменной нашего сервера наружу; английский на
 * русском экране; и указание сделать то, чего человек сделать НЕ МОЖЕТ —
 * настройки сервера ему недоступны. Совет, который нельзя выполнить, хуже
 * молчания: он выглядит объяснением и заставляет искать несуществующую кнопку.
 *
 * Теперь наружу идёт состояние и следующий шаг, а имена переменных остаются
 * там, где они нужны, — в ответе `/api/devhub/studio/capabilities`, который
 * читают мы, а не покупатель.
 */
export function capabilityHint(idx: CapabilityIndex | null, id: string, label: string): string {
  const c = idx?.[id];
  if (!c || !c.status || c.status === "live") return `${label}`;
  const alt = ALTERNATIVE[id];
  return `${label}: канал пока не подключён на нашей стороне.${alt ? ` ${alt}` : ""}`;
}

/**
 * Где у недоступного канала есть РАБОЧАЯ замена — называем её. Без этого
 * сообщение честное, но бесполезное: человек узнаёт, что нельзя, и не узнаёт,
 * что можно. Замер 28.08.2026: на проде `vercel` — `needs_token`, `railway` —
 * `not_available`, а `pages` — `live`, то есть выкатка работает и обе
 * недоступные кнопки имеют куда отослать.
 */
const ALTERNATIVE: Record<string, string> = {
  vercel: "Публикуйте кнопкой «Опубликовать на Cloudflare Pages» — она работает.",
  railway: "Публикуйте кнопкой «Опубликовать на Cloudflare Pages» — она работает.",
};
