/**
 * Resolve the QSign HMAC signing secret with production fail-closed gating.
 *
 * Until 2026-05-08 several call sites read `process.env.QSIGN_SECRET ||
 * "dev-qsign-secret"`. The fallback is a public string in OSS source — anyone
 * could forge HMAC signatures used for receipts (qsign.ts) and Planet
 * compliance vote snapshots (planetCompliance.ts).
 *
 * This helper is the single source of truth. Mirrors the contract of
 * `getJwtSecret()` in lib/authJwt.ts.
 *
 * Production:
 *   - Throws if QSIGN_SECRET is unset, < 32 chars, or starts with "dev-".
 *   - Caller should let the throw propagate (route handler returns 500).
 *
 * Non-production:
 *   - Returns env value when set, otherwise a stable dev default. Tests
 *     and local runs work without manual env wiring.
 */
export function getQSignSecret(): string {
  return requireProdSecret("QSIGN_SECRET", "dev-qsign-secret");
}

/**
 * Generic env-secret resolver with the same fail-closed gate. Use for
 * webhook signing secrets, etc. — anywhere an HMAC key is read from env.
 *
 * @param envKey  process.env key (e.g. "QRIGHT_WEBHOOK_SECRET")
 * @param devFallback  value returned in non-production when env is unset.
 *                     Must start with "dev-" and be informative; never used
 *                     in prod since we throw before reaching it.
 */
export function requireProdSecret(envKey: string, devFallback: string): string {
  const secret = process.env[envKey];
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || secret.startsWith("dev-")) {
      throw new Error(
        `${envKey} is missing or weak in production — refusing to use a default. Set ${envKey} to a 32+ char random string.`,
      );
    }
    return secret;
  }
  return secret || devFallback;
}
