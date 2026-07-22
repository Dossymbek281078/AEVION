/**
 * Shared paywall-awareness for prod smokes.
 *
 * Since PAYWALL_MODULES went live on prod (planGate.ts, PR #434/#439),
 * gated modules answer anonymous calls with 402 upgrade_required. For an
 * unauthenticated smoke that is CORRECT behavior — the gate doing its job —
 * so smokes must verify the 402 contract instead of counting it as a
 * failure. A 402 with a malformed body still fails: that would be a real
 * regression in the gate itself.
 */

/** True when the response is a well-formed planGate 402. */
function isPaywall402(res) {
  const b = res && res.body;
  return !!(
    res &&
    res.status === 402 &&
    b &&
    b.error === "upgrade_required" &&
    typeof b.module === "string" &&
    Array.isArray(b.requiredTiers) &&
    b.requiredTiers.length > 0 &&
    typeof b.upgradeUrl === "string" &&
    b.upgradeUrl.startsWith("http")
  );
}

/** Short annotation for an ok() line. */
function paywallNote(res) {
  const b = res.body || {};
  return `402 paywalled (${b.module}: ${(b.requiredTiers || []).join("/")})`;
}

/**
 * Early-exit probe for smokes whose ENTIRE module sits behind the gate.
 * GETs `path`; when it returns a well-formed 402, prints a summary and
 * returns true — the caller should then exit 0, because no functional
 * check is reachable without an entitled account. Any other response
 * (including a malformed 402) returns false and the smoke proceeds.
 */
async function moduleFullyPaywalled(BASE, path, moduleName) {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    let body = {};
    try { body = await r.json(); } catch { /* non-JSON → not a gate reply */ }
    const res = { status: r.status, body };
    if (isPaywall402(res)) {
      console.log(`  ✓ module '${moduleName}' is paywalled — 402 gate contract verified (${paywallNote(res)})`);
      console.log(`\n  Functional checks skipped: smoke has no entitled account. Gate contract IS the prod contract for anonymous callers.`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = { isPaywall402, paywallNote, moduleFullyPaywalled };
