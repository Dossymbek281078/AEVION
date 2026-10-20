/**
 * Словарь публичной страницы проверки /qsign/verify/[id] — ru/en/kk.
 *
 * 20.10.2026, окно «Приложения» (развилка 2 по слову оркестратора): страница была
 * целиком английской при любом языке посетителя. Это серверный компонент, поэтому
 * React-контекст из lib/i18n сюда не импортировать; язык берёт getServerLang()
 * (кука aevion_lang → Accept-Language → en), а клиентские кнопки (ClientBits) —
 * useI18nOptional. Словарь — чистые данные, одинаково годится обеим сторонам.
 *
 * Не переводятся значения: хеши, id ключей, имена алгоритмов (HMAC-SHA256,
 * Ed25519, RFC 8785, SHA-256), адреса. Подстановки — {name}, как в lib/i18n-data.
 */

import { interpolate } from "@/lib/i18n-data";

const EN = {
  "meta.title": "QSign verification — AEVION",
  "meta.description": "Public verification page for a QSign v2 signature (RFC 8785 + HMAC + Ed25519).",
  "meta.ogDescription": "RFC 8785 + HMAC + Ed25519 signature verification.",
  "meta.status.revoked": "revoked",
  "meta.status.valid": "valid",
  "meta.status.invalid": "invalid",
  "meta.desc": "Signature {id} · {status}",

  "unavailable.kicker": "Signature not found",
  "unavailable.text":
    "This QSign signature was not found. Either the link is wrong, or the service is temporarily unavailable — try again in a minute.",
  "unavailable.back": "← Back to QSign Studio",

  "nav.studio": "← QSign Studio",
  "nav.planet": "AEVION Planet",

  "banner.revoked": "REVOKED",
  "banner.valid": "VALID SIGNATURE",
  "banner.invalid": "INVALID SIGNATURE",
  "banner.revokedCaption":
    "This signature was revoked by its issuer. Historical cryptographic validity is unchanged, but the signature is no longer in force.",
  "banner.validCaption": "All cryptographic checks passed. The payload has not been altered since it was signed.",
  "banner.invalidCaption": "One or more cryptographic checks failed. Do not trust this payload.",
  "banner.signed": "signed: {t} UTC",
  "banner.revokedAt": "revoked: {t} UTC",

  "revocation.reason": "Revocation reason",

  "check.notChecked": "not checked",
  "check.valid": "valid",
  "check.invalid": "invalid",
  "check.keyId": "key id",
  "check.signature": "signature",
  "check.publicKey": "public key",

  "payload.title": "Signed payload",
  "payload.copy": "copy payload",
  "payload.copyCanonical": "copy canonical",
  "payload.canonicalization": "Canonicalization",
  "payload.canonicalizationNote": "{scheme} — keys sorted, no whitespace, deterministic.",
  "payload.hash": "SHA-256 hash of canonical",
  "payload.copyHash": "copy hash",

  "issuer.title": "Issuer",
  "issuer.email": "email",
  "issuer.anonymous": "Anonymous issuer",

  "geo.title": "Geo anchor",
  "geo.source": "source",
  "geo.location": "location",
  "geo.coords": "coords",
  "geo.none": "No geo data attached to this signature.",

  "how.title": "Verify independently",
  "how.1a": "Canonicalize the payload per",
  "how.1b": "— sort keys lexicographically, strip whitespace.",
  "how.2": "SHA-256 of the canonical string should equal",
  "how.3": "HMAC-SHA256 verify requires the shared secret published under key id",
  "how.4": "Ed25519 verify is fully public: use the public key",
  "how.machine": "Machine-readable view:",

  "copy.copy": "copy",
  "copy.copied": "copied",
  "copy.err": "err",
  "share.share": "Share",
  "share.copied": "Link copied",
  "share.title": "QSign verification",
} as const;

export type VerifyKey = keyof typeof EN;

const RU: Record<VerifyKey, string> = {
  "meta.title": "Проверка подписи QSign — AEVION",
  "meta.description": "Публичная страница проверки подписи QSign v2 (RFC 8785 + HMAC + Ed25519).",
  "meta.ogDescription": "Проверка подписи RFC 8785 + HMAC + Ed25519.",
  "meta.status.revoked": "отозвана",
  "meta.status.valid": "действительна",
  "meta.status.invalid": "недействительна",
  "meta.desc": "Подпись {id} · {status}",

  "unavailable.kicker": "Подпись не найдена",
  "unavailable.text":
    "Подпись QSign не найдена. Либо ссылка неверна, либо сервис временно недоступен — попробуйте через минуту.",
  "unavailable.back": "← Назад в QSign",

  "nav.studio": "← QSign",
  "nav.planet": "AEVION Планета",

  "banner.revoked": "ОТОЗВАНА",
  "banner.valid": "ПОДПИСЬ ДЕЙСТВИТЕЛЬНА",
  "banner.invalid": "ПОДПИСЬ НЕДЕЙСТВИТЕЛЬНА",
  "banner.revokedCaption":
    "Подпись отозвана её издателем. Криптографически она по-прежнему верна, но больше не имеет силы.",
  "banner.validCaption": "Все криптографические проверки пройдены. Данные не менялись с момента подписания.",
  "banner.invalidCaption": "Одна или несколько криптографических проверок не пройдены. Не доверяйте этим данным.",
  "banner.signed": "подписано: {t} UTC",
  "banner.revokedAt": "отозвано: {t} UTC",

  "revocation.reason": "Причина отзыва",

  "check.notChecked": "не проверялась",
  "check.valid": "верна",
  "check.invalid": "неверна",
  "check.keyId": "идентификатор ключа",
  "check.signature": "подпись",
  "check.publicKey": "открытый ключ",

  "payload.title": "Подписанные данные",
  "payload.copy": "копировать данные",
  "payload.copyCanonical": "копировать каноническую форму",
  "payload.canonicalization": "Канонизация",
  "payload.canonicalizationNote": "{scheme} — ключи отсортированы, без пробелов, детерминированно.",
  "payload.hash": "SHA-256 канонической формы",
  "payload.copyHash": "копировать хеш",

  "issuer.title": "Издатель",
  "issuer.email": "почта",
  "issuer.anonymous": "Анонимный издатель",

  "geo.title": "Привязка к месту",
  "geo.source": "источник",
  "geo.location": "место",
  "geo.coords": "координаты",
  "geo.none": "К этой подписи не приложены геоданные.",

  "how.title": "Проверьте сами",
  "how.1a": "Приведите данные к канонической форме по",
  "how.1b": "— ключи по алфавиту, без пробелов.",
  "how.2": "SHA-256 канонической строки должен совпасть с",
  "how.3": "Проверка HMAC-SHA256 требует общий секрет, опубликованный под идентификатором ключа",
  "how.4": "Проверка Ed25519 полностью публична: используйте открытый ключ",
  "how.machine": "Машиночитаемый вид:",

  "copy.copy": "копировать",
  "copy.copied": "скопировано",
  "copy.err": "ошибка",
  "share.share": "Поделиться",
  "share.copied": "Ссылка скопирована",
  "share.title": "Проверка подписи QSign",
};

const KK: Record<VerifyKey, string> = {
  "meta.title": "QSign қолтаңбасын тексеру — AEVION",
  "meta.description": "QSign v2 қолтаңбасын тексерудің жалпыға ашық беті (RFC 8785 + HMAC + Ed25519).",
  "meta.ogDescription": "RFC 8785 + HMAC + Ed25519 қолтаңбасын тексеру.",
  "meta.status.revoked": "кері қайтарылған",
  "meta.status.valid": "жарамды",
  "meta.status.invalid": "жарамсыз",
  "meta.desc": "Қолтаңба {id} · {status}",

  "unavailable.kicker": "Қолтаңба табылмады",
  "unavailable.text":
    "QSign қолтаңбасы табылмады. Сілтеме қате немесе қызмет уақытша қолжетімсіз — бір минуттан кейін қайталаңыз.",
  "unavailable.back": "← QSign-ға оралу",

  "nav.studio": "← QSign",
  "nav.planet": "AEVION Планета",

  "banner.revoked": "КЕРІ ҚАЙТАРЫЛҒАН",
  "banner.valid": "ҚОЛТАҢБА ЖАРАМДЫ",
  "banner.invalid": "ҚОЛТАҢБА ЖАРАМСЫЗ",
  "banner.revokedCaption":
    "Қолтаңбаны шығарушысы кері қайтарды. Криптографиялық тұрғыда ол әлі дұрыс, бірақ енді күші жоқ.",
  "banner.validCaption": "Барлық криптографиялық тексерулерден өтті. Деректер қол қойылғаннан бері өзгермеген.",
  "banner.invalidCaption": "Бір немесе бірнеше криптографиялық тексеруден өтпеді. Бұл деректерге сенбеңіз.",
  "banner.signed": "қол қойылды: {t} UTC",
  "banner.revokedAt": "кері қайтарылды: {t} UTC",

  "revocation.reason": "Кері қайтару себебі",

  "check.notChecked": "тексерілмеді",
  "check.valid": "дұрыс",
  "check.invalid": "қате",
  "check.keyId": "кілт идентификаторы",
  "check.signature": "қолтаңба",
  "check.publicKey": "ашық кілт",

  "payload.title": "Қол қойылған деректер",
  "payload.copy": "деректерді көшіру",
  "payload.copyCanonical": "канондық пішінді көшіру",
  "payload.canonicalization": "Канондау",
  "payload.canonicalizationNote": "{scheme} — кілттер сұрыпталған, бос орынсыз, детерминирленген.",
  "payload.hash": "Канондық пішіннің SHA-256 хеші",
  "payload.copyHash": "хешті көшіру",

  "issuer.title": "Шығарушы",
  "issuer.email": "пошта",
  "issuer.anonymous": "Анонимді шығарушы",

  "geo.title": "Орынға байлау",
  "geo.source": "көзі",
  "geo.location": "орны",
  "geo.coords": "координаттар",
  "geo.none": "Бұл қолтаңбаға геодеректер тіркелмеген.",

  "how.title": "Өзіңіз тексеріңіз",
  "how.1a": "Деректерді канондық пішінге келтіріңіз:",
  "how.1b": "— кілттер әліпби бойынша, бос орынсыз.",
  "how.2": "Канондық жолдың SHA-256 хеші мынаған тең болуы керек:",
  "how.3": "HMAC-SHA256 тексеруіне мына кілт идентификаторымен жарияланған ортақ құпия керек:",
  "how.4": "Ed25519 тексеруі толық ашық: ашық кілтті қолданыңыз",
  "how.machine": "Машина оқитын түрі:",

  "copy.copy": "көшіру",
  "copy.copied": "көшірілді",
  "copy.err": "қате",
  "share.share": "Бөлісу",
  "share.copied": "Сілтеме көшірілді",
  "share.title": "QSign қолтаңбасын тексеру",
};

export const VERIFY_DICT: Partial<Record<string, Record<VerifyKey, string>>> = { en: EN, ru: RU, kk: KK };
export const VERIFY_KEYS = Object.keys(EN) as VerifyKey[];

export function tVerify(lang: string | undefined, key: VerifyKey, vars?: Record<string, string | number>): string {
  return interpolate((lang && VERIFY_DICT[lang]?.[key]) ?? EN[key], vars);
}
