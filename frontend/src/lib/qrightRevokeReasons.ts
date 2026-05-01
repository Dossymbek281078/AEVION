// Single source of truth for QRight revocation reason codes + their
// localized labels. Keep in lockstep with REVOKE_REASON_CODES on the
// backend (aevion-globus-backend/src/routes/qright.ts) — the backend
// rejects any code not in its allowlist, so adding a new code here
// without backend changes will surface as a 400 to the user.

import type { Lang } from "./i18n";

// Codes shown to the owner in their own revoke modal. Excludes
// "admin-takedown" — that code is admin-set only.
export const OWNER_REVOKE_REASON_CODES = [
  "license-conflict",
  "withdrawn",
  "dispute",
  "mistake",
  "superseded",
  "other",
] as const;

// Codes available to admins in force-revoke surfaces.
export const ADMIN_REVOKE_REASON_CODES = [
  "admin-takedown",
  "dispute",
  "license-conflict",
  "mistake",
  "other",
] as const;

const LABELS_EN: Record<string, string> = {
  "license-conflict": "License conflict",
  withdrawn: "Withdrawn by author",
  dispute: "Disputed authorship",
  mistake: "Registered by mistake",
  superseded: "Superseded by new version",
  other: "Other",
  "admin-takedown": "Admin takedown",
  // Synthetic bucket used by /api/qright/transparency for revoked rows
  // that pre-date the reasonCode field. Not a code accepted on POST.
  unspecified: "Reason unspecified",
};

const LABELS_RU: Record<string, string> = {
  "license-conflict": "Конфликт лицензии",
  withdrawn: "Отозвано автором",
  dispute: "Спор об авторстве",
  mistake: "Зарегистрировано по ошибке",
  superseded: "Заменено новой версией",
  other: "Другое",
  "admin-takedown": "Снято администратором",
  unspecified: "Причина не указана",
};

const TABLES: Record<Lang, Record<string, string>> = {
  en: LABELS_EN,
  ru: LABELS_RU,
};

// Lookup with graceful fallback: requested lang → English → raw code.
// `null`/`undefined`/empty input returns "Revoked" so callers can render
// a neutral label when the database has no code stored.
export function revokeReasonLabel(
  code: string | null | undefined,
  lang: Lang = "en"
): string {
  if (!code) return lang === "ru" ? "Отозвано" : "Revoked";
  const table = TABLES[lang] || LABELS_EN;
  return table[code] || LABELS_EN[code] || code;
}
