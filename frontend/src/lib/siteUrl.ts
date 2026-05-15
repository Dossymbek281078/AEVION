// Returns the canonical public site origin for use in metadata,
// canonical URLs and JSON-LD structured data. Falls back to the
// production host when the env var is unset (preview deployments,
// local dev) so build never breaks.
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "https://aevion.app";
  return raw.replace(/\/+$/, "");
}
