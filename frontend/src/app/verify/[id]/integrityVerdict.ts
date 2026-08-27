/**
 * Вердикт страницы проверки сертификата — и плитки, из которых он собран.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. До 27.08.2026 баннер считался ОТДЕЛЬНО от таблицы:
 *
 *     const allChecksPass = integrity.contentHashValid &&
 *                           integrity.quantumShieldStatus === "active";
 *
 * — две оси из семи, а текст под баннером обещал «Every cryptographic layer
 * matches», и подсказка над таблицей говорила «fully valid only when every
 * tile is green». То есть страница могла показать зелёный баннер с этим
 * обещанием и КРАСНУЮ плитку прямо под ним. У сертификатов апрельской выдачи
 * так и происходило: соподпись автора у них отсутствует по определению
 * (`present: false` → плитка красная), а баннер этого не видел.
 *
 * Здесь вердикт выводится ИЗ ПЛИТОК. Противоречие между баннером и таблицей
 * теперь невозможно структурно, а не по внимательности того, кто правит файл.
 */

/** Ось проверки. Определяет, во что превращается красная плитка. */
export type CheckTier =
  /** Сломано сейчас: хеш не сошёлся, подпись не пересчиталась, отзыв. */
  | "core"
  /** Слоя не существовало в момент выдачи. Не поломка, а возраст записи. */
  | "era";

export type IntegrityCheck = {
  label: string;
  status: boolean;
  detail: string;
  tier: CheckTier;
  tip?: { name: string; text: string };
};

/** Ровно те поля ответа, которые нужны для вердикта. */
export type VerdictInput = {
  /**
   * Вердикт сервера. Появился 27.08.2026; у старой сборки бэкенда поля нет,
   * и тогда здесь undefined — это «сервер не сказал», а не «сервер сказал нет».
   */
  integrityVerified?: boolean;
  certificate: { status: string };
  integrity: {
    contentHashValid: boolean;
    /**
     * Каким правилом сошёлся хеш. Появилось 27.08.2026; у старой сборки поля
     * нет. "v1" — правило до канонизации: страна и город хешем НЕ покрыты,
     * и человеку это говорится прямо, а не прячется за общим зелёным.
     */
    contentHashRule?: "v1" | "v2" | null;
    signatureHmacValid: boolean | null;
    signatureHmacReason?: "OK" | "NO_SIGNED_AT" | "MISMATCH" | "ERROR";
    qsignKeyVersion?: number;
    currentKeyVersion?: number;
    keyRotatedSinceSigning?: boolean;
    quantumShieldStatus: string;
    shieldLegacy?: boolean;
    shards: number;
    threshold: number;
    authorCosign?:
      | { present: false }
      | { present: true; valid: boolean; fingerprint: string };
  };
};

export type Verdict =
  /** Все плитки зелёные. Только здесь можно обещать «сошлось всё». */
  | "verified"
  /** Сломанного нет, но часть слоёв моложе самого сертификата. */
  | "verified-legacy"
  /** Хотя бы одна проверка не сошлась ИЛИ сервер не подтвердил целостность. */
  | "warning";

/**
 * Плитки в том же порядке, в каком они на экране.
 *
 * Функция чистая: ни одного обращения к сети, времени или окружению —
 * поэтому её можно прогнать тестом на любом наборе входов.
 */
export function buildIntegrityChecks(data: VerdictInput): IntegrityCheck[] {
  const { integrity } = data;
  const certKv = integrity.qsignKeyVersion ?? 1;
  const curKv = integrity.currentKeyVersion ?? 1;
  const rotated = integrity.keyRotatedSinceSigning === true;
  const hmacOk = integrity.signatureHmacValid === true;

  // Отсутствие signedAt — свойство СТАРОЙ строки, а не признак подделки:
  // подпись нечем пересчитать, потому что нечего подставить в неё временем.
  const hmacIsEraGap = integrity.signatureHmacReason === "NO_SIGNED_AT";

  const cosign: IntegrityCheck = (() => {
    const co = integrity.authorCosign;
    if (!co || !co.present) {
      return {
        label: "Author Co-Signature",
        status: false,
        // Сертификат выдан до появления слоя — возраст, не поломка.
        tier: "era",
        detail: "Not signed by author (legacy single-party cert)",
        tip: {
          name: "Author co-signing",
          text: "Modern AEVION certificates carry a second Ed25519 signature held only by the author's browser. This row was protected before that layer existed — its other integrity checks remain valid.",
        },
      };
    }
    return {
      label: "Author Co-Signature",
      // Соподпись ЕСТЬ и не сходится — это уже настоящая поломка, не возраст.
      tier: "core",
      status: co.valid,
      detail: co.valid
        ? `Verified · author key ed25519:${co.fingerprint}`
        : `Signature mismatch · purported key ed25519:${co.fingerprint || "unknown"}`,
      tip: {
        name: "Author co-signing",
        text: "An Ed25519 signature made with the author's browser-held private key. AEVION never sees this key — even a full platform breach cannot forge a valid co-signature for someone else's identity.",
      },
    };
  })();

  return [
    {
      label: "Content Hash",
      status: integrity.contentHashValid,
      tier: "core",
      detail: !integrity.contentHashValid
        ? "Hash mismatch"
        : integrity.contentHashRule === "v1"
          ? // Названо прямо: под старым правилом место регистрации хешем не
            // покрывалось, значит его правку этот сертификат не обнаружит.
            "SHA-256 verified under the v1 rule — location not covered"
          : "SHA-256 verified",
      tip: {
        name: "Content Hash",
        text:
          integrity.contentHashRule === "v1"
            ? "We re-hash the certificate's metadata with SHA-256 and compare it to the stored value. This certificate was issued before AEVION canonicalised the hash: it covers the title, description and work type, but not the country and city. Those two fields are recorded on the certificate but not protected by this hash."
            : "We re-hash the certificate's metadata with SHA-256 and compare it to the stored value. Match means the registered fields have not changed since protection.",
      },
    },
    {
      label: "HMAC Signature",
      status: hmacOk,
      tier: hmacIsEraGap ? "era" : "core",
      detail: hmacOk
        ? "HMAC-SHA256 re-verified"
        : hmacIsEraGap
          ? "Legacy row — signedAt not recorded"
          : integrity.signatureHmacReason === "MISMATCH"
            ? "Signature mismatch"
            : "Verification error",
      tip: {
        name: "HMAC Signature",
        text: "We recompute the HMAC-SHA256 from the certificate's signed fields with the secret key version that signed it, and compare. Match proves no field has been tampered with.",
      },
    },
    {
      label: "HMAC Key Version",
      status: hmacOk,
      tier: hmacIsEraGap ? "era" : "core",
      detail: rotated
        ? `Signed under v${certKv} · current is v${curKv} · key rotated, signature still valid`
        : `Signed under v${certKv} · current key`,
      tip: {
        name: "Key Rotation",
        text: "AEVION can rotate signing keys without invalidating older certificates. Each row records the version it was signed with, so we always verify under the right key.",
      },
    },
    {
      label: "Quantum Shield",
      status:
        integrity.quantumShieldStatus === "active" &&
        integrity.shieldLegacy !== true,
      // Щит не «active» — это поломка сейчас; «legacy» — возраст.
      // Поэтому ось выбирается по причине, а не по цвету плитки.
      tier: integrity.quantumShieldStatus === "active" ? "era" : "core",
      detail:
        integrity.shieldLegacy === true
          ? "Legacy shield (pre-v2)"
          : `Status: ${integrity.quantumShieldStatus}`,
      tip: {
        name: "Quantum Shield",
        text: "AEVION's protection envelope. Combines Ed25519 signing with Shamir secret-sharing so no single party can recover the private key alone.",
      },
    },
    {
      label: "Secret Sharing",
      status: integrity.shieldLegacy !== true,
      tier: "era",
      detail:
        integrity.shieldLegacy === true
          ? "Legacy — not real SSS"
          : `${integrity.shards} shards, threshold ${integrity.threshold} (Shamir SSS)`,
      tip: {
        name: "Shamir Secret Sharing",
        text: "The Ed25519 private key is split into 3 shards. Any 2 reconstruct it; any 1 alone reveals nothing. AEVION never holds 2 of them.",
      },
    },
    cosign,
    {
      label: "Certificate Status",
      status: data.certificate.status === "active",
      tier: "core",
      detail: data.certificate.status,
    },
  ];
}

/**
 * Вердикт по плиткам.
 *
 * Строгость направлена в одну сторону намеренно: страница не имеет права
 * обещать БОЛЬШЕ, чем подтвердил сервер. Если сервер прислал
 * `integrityVerified: false`, вердикт «warning», даже когда все плитки
 * зелёные, — расхождение означает, что одна из сторон считает неверно, и
 * до выяснения человеку нельзя показывать «сошлось».
 *
 * Обратное НЕ верно: `integrityVerified: true` не делает красную плитку
 * зелёной. Сервер знает про три оси, таблица — про семь.
 */
export function deriveVerdict(
  checks: IntegrityCheck[],
  serverSaysIntegrityVerified?: boolean,
): Verdict {
  if (checks.some((c) => !c.status && c.tier === "core")) return "warning";
  if (serverSaysIntegrityVerified === false) return "warning";
  if (checks.some((c) => !c.status)) return "verified-legacy";
  return "verified";
}

/** Текст баннера. Отдельно, чтобы обещание нельзя было поправить мимо вердикта. */
export function verdictCopy(verdict: Verdict): {
  icon: string;
  title: string;
  body: string;
  tone: "good" | "muted" | "bad";
} {
  switch (verdict) {
    case "verified":
      return {
        icon: "✅",
        tone: "good",
        title: "Certificate Verified",
        body: "Every cryptographic layer matches. The work below was registered by the named author at the time shown, and no field has been altered since.",
      };
    case "verified-legacy":
      return {
        icon: "✅",
        tone: "muted",
        title: "Certificate Verified",
        // Ровно то, что проверено, и ровно то, что нет. Без «every layer».
        body: "Every check that applies to this certificate matches — nothing has been altered since registration. Some layers below are marked grey because they did not exist yet when this certificate was issued; that is its age, not a failure.",
      };
    case "warning":
      return {
        icon: "⚠️",
        tone: "bad",
        title: "Verification Warning",
        body: "One or more integrity layers did not match. The per-layer breakdown below shows exactly which check failed and what it means.",
      };
  }
}
