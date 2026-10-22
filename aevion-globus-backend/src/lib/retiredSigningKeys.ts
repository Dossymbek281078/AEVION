// Отставленные (ротированные) открытые ключи Ed25519 платформы.
//
// 🔴 22.10.2026, утечка переменных Railway (blog.railway.com 21.10 20:44Z): закрытые ключи подписи
// QSKYWAY_SIGN_SK / AEVION_TRUST_SIGN_SK считаются засвеченными и подлежат замене. Смена ключа «в лоб»
// ломала проверку всего, что уже подписано: trustSignature.verifySignedTrustScore сравнивал открытый ключ
// документа ТОЛЬКО с живым ключом (isPlatformKey), а qskyway проверял подпись ТОЛЬКО живым SIGN_PK.
// После ротации выданные документы отвечали бы «чужая подпись» — неправда: подписала платформа, но прежним
// ключом.
//
// Решение (решение Продукта по плану 2026-10-22-УТЕЧКА-RAILWAY-ротация-секретов.md, очередь Б):
// новый закрытый ключ подписывает, прежние ОТКРЫТЫЕ ключи остаются в списке для проверки с датой отставки.
// Закрытый засвеченный ключ в окружении не хранится вовсе — для проверки нужен только открытый.
//
// Переменная: AEVION_RETIRED_SIGN_PKS = "<spki-der-base64>@<YYYY-MM-DD>[,<...>@<...>]"
//   Открытый ключ выводится из старого закрытого скриптом scripts/derive-ed25519-pk.mjs (печатает ТОЛЬКО
//   открытую часть). Дата — день отставки: с него подписи этим ключом не считаются подписью платформы по
//   времени; без внешнего якоря времени (OTS) сервер не может отличить подпись «до» от подписи «после»,
//   поэтому вердикт честно говорит keyStatus: "retired" и retiredAt, а не голое valid: true.
//
// Неразобранная запись не молчит: строка в журнал (класс «переменная задана, а работает как без неё»).
import crypto from "crypto";

export interface RetiredSigningKey {
  /** base64 SPKI DER — та же форма, что attestation.publicKey в документах */
  publicKey: string;
  keyObject: crypto.KeyObject;
  /** первые 16 hex SHA-256(SPKI DER) — короткий id, как у живого ключа */
  keyFingerprint: string;
  /** день отставки, YYYY-MM-DD */
  retiredAt: string;
}

export type PlatformKeyStatus = "active" | "retired" | "foreign";

export const RETIRED_KEYS_ENV = "AEVION_RETIRED_SIGN_PKS";

export function fingerprintOfSpkiDer(der: Buffer): string {
  return crypto.createHash("sha256").update(der).digest("hex").slice(0, 16);
}

let cache: { raw: string | undefined; keys: RetiredSigningKey[] } | null = null;

/**
 * Разбор переменной; результат кэшируется по сырому значению, чтобы тесты могли менять env между случаями.
 * Запись без даты или с неразобранным ключом пропускается с предупреждением в журнале.
 */
export function retiredSigningKeys(): RetiredSigningKey[] {
  const raw = process.env[RETIRED_KEYS_ENV];
  if (cache && cache.raw === raw) return cache.keys;
  const keys: RetiredSigningKey[] = [];
  for (const entry of (raw ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)) {
    const at = entry.lastIndexOf("@");
    const publicKey = at > 0 ? entry.slice(0, at) : entry;
    const retiredAt = at > 0 ? entry.slice(at + 1) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(retiredAt)) {
      console.warn(`[retired-keys] ${RETIRED_KEYS_ENV}: запись без даты отставки (нужно <ключ>@YYYY-MM-DD) — пропущена`);
      continue;
    }
    try {
      const der = Buffer.from(publicKey, "base64");
      const keyObject = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
      if (keyObject.asymmetricKeyType !== "ed25519") {
        console.warn(`[retired-keys] ${RETIRED_KEYS_ENV}: ключ не Ed25519 (${keyObject.asymmetricKeyType}) — пропущен`);
        continue;
      }
      keys.push({ publicKey, keyObject, keyFingerprint: fingerprintOfSpkiDer(der), retiredAt });
    } catch (e) {
      console.warn(`[retired-keys] ${RETIRED_KEYS_ENV}: ключ не разобран — пропущен:`, e instanceof Error ? e.message : e);
    }
  }
  cache = { raw, keys };
  return keys;
}

/** Открытые сведения для публикации рядом с живым ключом (без закрытых частей — их и нет). */
export function retiredSigningKeysPublic(): Array<{ publicKey: string; keyFingerprint: string; retiredAt: string }> {
  return retiredSigningKeys().map(({ publicKey, keyFingerprint, retiredAt }) => ({ publicKey, keyFingerprint, retiredAt }));
}

/**
 * Чей это открытый ключ: живой ключ платформы, отставленный (с датой) или чужой.
 * `currentPublicKey` — base64 SPKI живого ключа модуля-вызывателя.
 */
export function classifyPlatformKey(
  publicKey: string,
  currentPublicKey: string,
): { status: PlatformKeyStatus; retiredAt?: string; keyFingerprint?: string } {
  if (publicKey === currentPublicKey) return { status: "active" };
  const r = retiredSigningKeys().find((k) => k.publicKey === publicKey);
  if (r) return { status: "retired", retiredAt: r.retiredAt, keyFingerprint: r.keyFingerprint };
  return { status: "foreign" };
}

/**
 * Проверка подписи Ed25519 над hex-хэшем живым ключом, а при неудаче — каждым отставленным.
 * Возвращает, каким ключом подпись сошлась; null — ни одним.
 */
export function verifyWithPlatformKeys(
  contentHashHex: string,
  signatureB64: string,
  current: { keyObject: crypto.KeyObject; publicKey: string },
): { status: "active" } | { status: "retired"; retiredAt: string; publicKey: string; keyFingerprint: string } | null {
  const msg = Buffer.from(contentHashHex, "hex");
  const sig = Buffer.from(signatureB64, "base64");
  const tryKey = (k: crypto.KeyObject): boolean => {
    try {
      return crypto.verify(null, msg, k, sig);
    } catch {
      return false;
    }
  };
  if (tryKey(current.keyObject)) return { status: "active" };
  for (const k of retiredSigningKeys()) {
    if (tryKey(k.keyObject)) return { status: "retired", retiredAt: k.retiredAt, publicKey: k.publicKey, keyFingerprint: k.keyFingerprint };
  }
  return null;
}

/** Только для тестов: сбросить кэш разбора. */
export function __resetRetiredKeysCache(): void {
  cache = null;
}
