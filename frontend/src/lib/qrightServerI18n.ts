// Server-side i18n for QRight public surfaces (/qright/transparency,
// /qright/object/[id]). Client surfaces use the React Context in
// `@/lib/i18n`; that module is "use client" and can't be imported from
// server components, so the server picks lang from the request and
// looks strings up against this static table.
//
// Lang resolution (highest priority first):
//   1. ?lang=en|ru in the URL — explicit override (shareable)
//   2. Accept-Language header — first langtag whose primary subtag is "ru"
//   3. fallback "en"
//
// Cookie-based persistence is intentionally NOT here — the client
// LangSwitch already mirrors `aevion_lang_v1` to localStorage. If we
// later want a server-side lang cookie, add a `cookies()` read above
// the Accept-Language fallback.

import type { Lang } from "./i18n";

type HeaderLike = {
  get(name: string): string | null;
};

export function pickLangFromHeaders(h: HeaderLike | null | undefined): Lang {
  const raw = h?.get("accept-language") || "";
  if (!raw) return "en";
  // Parse the first preference. Format: "ru-RU,ru;q=0.9,en;q=0.8".
  const first = raw.split(",")[0]?.trim().toLowerCase() || "";
  const primary = first.split(/[-_;]/)[0] || "";
  return primary === "ru" ? "ru" : "en";
}

export function pickLang(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  h: HeaderLike | null | undefined
): Lang {
  const sp = searchParams?.lang;
  const explicit = (Array.isArray(sp) ? sp[0] : sp || "").toLowerCase();
  if (explicit === "en" || explicit === "ru") return explicit as Lang;
  return pickLangFromHeaders(h);
}

type StringTable = Record<string, string>;

const TRANSPARENCY_EN: StringTable = {
  back: "← AEVION QRight",
  title: "QRight transparency",
  subtitle:
    "Public aggregate counts. Updates every ~5 min. No personally identifying data is exposed here — see {privacy} for the full data policy.",
  privacyLink: "privacy",
  headRegistered: "Registered total",
  headActive: "Currently active",
  headRevoked: "Revoked",
  headFirst: "First registration",
  byReason: "Revocations by reason",
  noRevokes: "No revocations on record.",
  totalRevSummary:
    "Total revocations: {total} of {registered} ({pct}%).",
  byKind: "Registrations by content type",
  noRegistrations: "No registrations yet.",
  generated: "Generated {ts}",
  failedTitle: "Failed to load",
  failedDetail: "The aggregate is temporarily unreachable. Try again later.",
};

const TRANSPARENCY_RU: StringTable = {
  back: "← AEVION QRight",
  title: "Прозрачность QRight",
  subtitle:
    "Публичная агрегированная статистика. Обновляется примерно каждые 5 минут. Здесь не раскрываются персональные данные — см. {privacy} для полной политики.",
  privacyLink: "политику конфиденциальности",
  headRegistered: "Всего регистраций",
  headActive: "Активных сейчас",
  headRevoked: "Отозвано",
  headFirst: "Первая регистрация",
  byReason: "Отозвано по причинам",
  noRevokes: "Отзывов пока нет.",
  totalRevSummary:
    "Всего отзывов: {total} из {registered} ({pct}%).",
  byKind: "Регистрации по типам контента",
  noRegistrations: "Пока нет регистраций.",
  generated: "Сгенерировано {ts}",
  failedTitle: "Не удалось загрузить",
  failedDetail:
    "Агрегатор временно недоступен. Попробуйте позже.",
};

const OBJECT_EN: StringTable = {
  back: "← AEVION QRight",
  registered: "REGISTERED",
  revoked: "REVOKED",
  registeredFull: "✓ REGISTERED",
  revokedFull: "✕ REVOKED",
  revokedNotice: "This registration has been revoked by the owner.",
  revokedReason: "Reason",
  untitled: "Untitled work",
  embedCta: "Get embed code →",
  recordTitle: "Registration record",
  kind: "Kind",
  owner: "Owner",
  location: "Location",
  registeredAt: "Registered",
  revokedAt: "Revoked",
  contentHash: "SHA-256 of canonical payload",
  objectId: "Object ID",
  verifyTitle: "Independent verification",
  verifyHelp:
    "The hash above is reproducible from the original work. To verify without trusting AEVION, drop the work's file plus the verification bundle into the offline verifier.",
  cryptoVerify: "Cryptographic verify →",
  offlineVerify: "Offline verifier →",
  embedJson: "Embed JSON",
  rawBadge: "Raw badge SVG",
  viewProof: "View proof →",
  notFoundTitle: "Not registered",
  notFoundDetail: "No QRight object with id {id}.",
  registerCta: "← Register your work on AEVION QRight",
  failedTitle: "Failed to load",
  failedDetail: "The AEVION registry is unreachable. Try again later.",
};

const OBJECT_RU: StringTable = {
  back: "← AEVION QRight",
  registered: "ЗАРЕГИСТРИРОВАНО",
  revoked: "ОТОЗВАНО",
  registeredFull: "✓ ЗАРЕГИСТРИРОВАНО",
  revokedFull: "✕ ОТОЗВАНО",
  revokedNotice: "Эта регистрация отозвана владельцем.",
  revokedReason: "Причина",
  untitled: "Без названия",
  embedCta: "Получить код для встраивания →",
  recordTitle: "Запись о регистрации",
  kind: "Тип",
  owner: "Владелец",
  location: "Местоположение",
  registeredAt: "Зарегистрировано",
  revokedAt: "Отозвано",
  contentHash: "SHA-256 канонической полезной нагрузки",
  objectId: "ID объекта",
  verifyTitle: "Независимая проверка",
  verifyHelp:
    "Хеш выше воспроизводим из оригинального произведения. Чтобы проверить без доверия к AEVION, загрузите файл произведения вместе с verification bundle в офлайн-верификатор.",
  cryptoVerify: "Криптопроверка →",
  offlineVerify: "Офлайн-верификатор →",
  embedJson: "Embed JSON",
  rawBadge: "SVG-бейдж",
  viewProof: "Смотреть доказательство →",
  notFoundTitle: "Не зарегистрировано",
  notFoundDetail: "Нет объекта QRight с id {id}.",
  registerCta: "← Зарегистрируйте произведение в AEVION QRight",
  failedTitle: "Не удалось загрузить",
  failedDetail: "Реестр AEVION временно недоступен. Попробуйте позже.",
};

const TABLES: Record<"transparency" | "object", Record<Lang, StringTable>> = {
  transparency: { en: TRANSPARENCY_EN, ru: TRANSPARENCY_RU },
  object: { en: OBJECT_EN, ru: OBJECT_RU },
};

// Tiny mustache-lite: replaces {key} tokens from `vars`. Missing tokens
// are left in place so the missing piece is visible in dev.
function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

export function tString(
  page: "transparency" | "object",
  lang: Lang,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  const table = TABLES[page][lang] || TABLES[page].en;
  const raw = table[key] ?? TABLES[page].en[key] ?? key;
  return Object.keys(vars).length > 0 ? interpolate(raw, vars) : raw;
}
