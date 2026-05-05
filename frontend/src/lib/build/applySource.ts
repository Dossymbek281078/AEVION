// Compute the source tag for an application based on the current URL.
// Recruiter-facing analytics bucket by prefix (utm:* | ref:* | widget | organic).
// Empty -> caller should send undefined and the backend will leave it null.

export function deriveApplySource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const sp = new URLSearchParams(window.location.search);
    const utmSource = sp.get("utm_source");
    if (utmSource) return `utm:${utmSource.toLowerCase().slice(0, 32)}`;
    const ref = sp.get("ref");
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
