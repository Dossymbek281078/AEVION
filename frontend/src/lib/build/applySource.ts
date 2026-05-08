// Compute the source tag + referrerByUserId for an application based on
// the current URL and persistent share-link state.
// Recruiter-facing analytics bucket by prefix (utm:* | ref:* | widget | organic).
// Empty -> caller should send undefined and the backend will leave it null.

const REF_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readPersistedRefToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem("qbuild.refToken");
    const ts = Number(localStorage.getItem("qbuild.refToken.ts") || "0");
    if (!token || !ts) return null;
    if (Date.now() - ts > REF_TOKEN_TTL_MS) {
      localStorage.removeItem("qbuild.refToken");
      localStorage.removeItem("qbuild.refToken.ts");
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function deriveApplySource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const sp = new URLSearchParams(window.location.search);
    const utmSource = sp.get("utm_source");
    if (utmSource === "ref_share" || utmSource === "share") {
      const refUser = sp.get("ref") || readPersistedRefToken();
      if (refUser) return `ref:${refUser.toLowerCase().slice(0, 32)}`;
    }
    if (utmSource) return `utm:${utmSource.toLowerCase().slice(0, 32)}`;
    const ref = sp.get("ref") || readPersistedRefToken();
    if (ref) return `ref:${ref.toLowerCase().slice(0, 32)}`;
    if (sp.get("from") === "widget") return "widget";
    // Document.referrer fallback — only set when it's an external origin.
    const r = document.referrer;
    if (r) {
      try {
        const u = new URL(r);
        if (u.origin !== window.location.origin) {
          return `ref:${u.hostname.replace(/^www\./, "").slice(0, 32)}`;
        }
      } catch {
        // ignore
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

// Pull the persistent referrer userId — used to fill the referredByUserId
// field on POST /applications so the share-link recruiter gets credit.
export function deriveReferrerUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const sp = new URLSearchParams(window.location.search);
    const fromQuery = sp.get("ref");
    if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim().slice(0, 200);
    const persisted = readPersistedRefToken();
    if (persisted) return persisted.slice(0, 200);
  } catch {
    return undefined;
  }
  return undefined;
}
