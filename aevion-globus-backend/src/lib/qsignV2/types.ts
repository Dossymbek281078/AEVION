export type QSignAlgo = "HMAC-SHA256" | "Ed25519";
export type QSignKeyStatus = "active" | "retired";
export type QSignGeoSource = "ip" | "gps";

export type QSignKeyRow = {
  id: string;
  kid: string;
  algo: QSignAlgo;
  publicKey: string | null;
  secretRef: string;
  status: QSignKeyStatus;
  notes: string | null;
  createdAt: Date;
  retiredAt: Date | null;
};

export type QSignSignatureRow = {
  id: string;
  hmacKid: string;
  ed25519Kid: string | null;
  payloadCanonical: string;
  payloadHash: string;
  signatureHmac: string;
  signatureEd25519: string | null;
  signatureDilithium: string | null;
  algoVersion: string;
  issuerUserId: string | null;
  issuerEmail: string | null;
  geoLat: number | null;
  geoLng: number | null;
  geoSource: QSignGeoSource | null;
  geoCountry: string | null;
  geoCity: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

export type QSignRevocationRow = {
  id: string;
  signatureId: string;
  reason: string;
  causalSignatureId: string | null;
  revokerUserId: string | null;
  revokedAt: Date;
};

/**
 * Two-mode Dilithium block. PREVIEW carries `digest`; REAL carries
 * `signature` + `publicKey`. Either may be present, but only one mode at
 * a time. Kept as a union so consumers can narrow on `mode`.
 *
 * Type name is preserved (not "Block" rename) for backward compat with
 * any external imports of `QSignDilithiumPreview`.
 */
export type QSignDilithiumPreview = {
  algo: "ML-DSA-65";
  kid: string;
  mode: "preview" | "real";
  digest?: string;
  signature?: string;
  publicKey?: string;
  valid: boolean | null;
  note: string;
};

export type QSignVerifyResult = {
  valid: boolean;
  signatureId?: string;
  algoVersion: string;
  hmac: { kid: string; valid: boolean };
  ed25519: { kid: string | null; valid: boolean | null };
  dilithium: QSignDilithiumPreview | null;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string | null;
  payloadHash: string;
  /*
   * Публичный ответ проверки. Полей `userId`, `city`, `lat`, `lng` здесь
   * больше НЕТ — и это не упрощение типа, а граница: тип и есть то место,
   * где видно, что уходит наружу.
   *
   * 08.09.2026 наружу уходили почта подписанта, его userId и координаты
   * подписания с точностью до метров — по идентификаторам, которые мы сами
   * печатаем в открытых списках. Подлинность удостоверяет КЛЮЧ: ни адрес,
   * ни точка на карте проверку не усиливают. Адрес остаётся маской, чтобы
   * страница проверки могла ответить на вопрос «кто подписал».
   */
  issuer: { email: string | null } | null;
  /*
   * У `geo` поля city/lat/lng СОХРАНЕНЫ в типе, но в публичном ответе всегда
   * null — и это не половинчатость, а осознанный размен.
   *
   * Страница проверки читает координаты сравнением `lat !== null`. Убери мы
   * ключи совсем, `undefined !== null` дало бы ИСТИНУ, и страница упала бы на
   * `.toFixed` — та самая страница, куда ведёт публичная ссылка проверки.
   * Клиент мы поправили на `!= null`, но между посадкой бэкенда и посадкой
   * сайта проходят минуты, и в эти минуты старый клиент читает новый ответ.
   * Явный null безопасен для обеих версий.
   */
  geo: {
    source: QSignGeoSource | null;
    country: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};
