/** Ответ публичной ручки проверки чека. Отдельный модуль, чтобы и страница,
 *  и чистая функция вердикта, и тесты читали один и тот же тип. */
export type VerifyResult = {
  hashMatches: boolean;
  computedHash: string;
  signature: "valid" | "invalid" | "absent" | "unverifiable";
  signatureNote: string | null;
  spec: { canonicalization: string; digest: string; signature: string };
};
