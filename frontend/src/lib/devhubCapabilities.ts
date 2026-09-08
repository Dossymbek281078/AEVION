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
/**
 * ПОДПИСИ ВОЗМОЖНОСТЕЙ — здесь, а не у пятнадцати вызовов.
 *
 * До 08.09.2026 каждый вызов передавал подпись зашитой русской строкой
 * («Генерация видео», «Выкатка на Vercel», …). Подсказка живёт в ТОСТЕ, а тост
 * — слепая зона машинного доводчика по устройству: он не успевает за текстом,
 * который держится секунды. То есть EN-посетитель, нажавший недоступную
 * кнопку, читал русскую фразу. На проде это не редкость: сегодня degraded у
 * перевода, github и озвучки, not_available у railway и домена.
 *
 * Незнакомый идентификатор берёт имя из ответа сервера, а если и его нет —
 * сам идентификатор: показать непонятное лучше, чем промолчать.
 */
const CAP_LABEL: Record<string, Record<string, string>> = {
  ru: {
    database: "База данных", railway: "Выкатка на Railway", pages: "Публикация на Cloudflare Pages",
    vercel: "Выкатка на Vercel", image: "Генерация картинок", audio_music: "Генерация музыки",
    audio_tts: "Озвучка", github: "Отправка в GitHub", video: "Генерация видео",
    "3d": "3D-генерация", translate: "Перевод", email: "Отправка почты",
  },
  en: {
    database: "Database", railway: "Railway deploy", pages: "Cloudflare Pages publishing",
    vercel: "Vercel deploy", image: "Image generation", audio_music: "Music generation",
    audio_tts: "Voice-over", github: "Push to GitHub", video: "Video generation",
    "3d": "3D generation", translate: "Translation", email: "Sending email",
  },
  kk: {
    database: "Дерекқор", railway: "Railway-ге жариялау", pages: "Cloudflare Pages-ке жариялау",
    vercel: "Vercel-ге жариялау", image: "Сурет генерациясы", audio_music: "Музыка генерациясы",
    audio_tts: "Дыбыстау", github: "GitHub-қа жіберу", video: "Бейне генерациясы",
    "3d": "3D генерация", translate: "Аударма", email: "Хат жіберу",
  },
};

const NOT_CONNECTED: Record<string, string> = {
  ru: "канал пока не подключён на нашей стороне.",
  en: "this channel is not connected on our side yet.",
  kk: "бұл арна біздің жақта әлі қосылмаған.",
};

export function capabilityHint(
  idx: CapabilityIndex | null,
  id: string,
  lang: string = "ru",
): string {
  const язык = CAP_LABEL[lang] ? lang : "en";
  const c = idx?.[id];
  const label = CAP_LABEL[язык][id] ?? c?.name ?? id;
  if (!c || !c.status || c.status === "live") return `${label}`;
  const alt = ALTERNATIVE[язык]?.[id];
  return `${label}: ${NOT_CONNECTED[язык]}${alt ? ` ${alt}` : ""}`;
}

/**
 * Где у недоступного канала есть РАБОЧАЯ замена — называем её. Без этого
 * сообщение честное, но бесполезное: человек узнаёт, что нельзя, и не узнаёт,
 * что можно. Замер 28.08.2026: на проде `vercel` — `needs_token`, `railway` —
 * `not_available`, а `pages` — `live`, то есть выкатка работает и обе
 * недоступные кнопки имеют куда отослать.
 */
const ALTERNATIVE: Record<string, Record<string, string>> = {
  ru: {
    vercel: "Публикуйте кнопкой «Опубликовать на Cloudflare Pages» — она работает.",
    railway: "Публикуйте кнопкой «Опубликовать на Cloudflare Pages» — она работает.",
  },
  en: {
    vercel: "Use the “Publish to Cloudflare Pages” button — it works.",
    railway: "Use the “Publish to Cloudflare Pages” button — it works.",
  },
  kk: {
    vercel: "«Cloudflare Pages-ке жариялау» түймесін қолданыңыз — ол жұмыс істейді.",
    railway: "«Cloudflare Pages-ке жариялау» түймесін қолданыңыз — ол жұмыс істейді.",
  },
};
