/**
 * Client-side mirror of the backend canonical content hash.
 *
 * MUST stay byte-for-byte identical with
 * `aevion-globus-backend/src/lib/contentHash.ts` — the author co-signature
 * is verified server-side against the server's recomputed hash, so any
 * drift between the two implementations breaks every co-sign.
 *
 * Spec:
 *   1. NFC-normalize each string field
 *   2. Default missing kind/title/description to "" / "other"
 *   3. Build {city, country, description, kind, title} with sorted keys
 *   4. JSON.stringify (sorted-keys output ⇒ deterministic bytes)
 *   5. SHA-256 → lower-case hex
 */

export interface ContentHashInput {
  title: string;
  description: string;
  kind: string;
  country?: string | null;
  city?: string | null;
}

function nfc(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v).normalize("NFC");
}

function canonicalizeContentInput(
  input: ContentHashInput,
): Record<string, string | null> {
  return {
    title: nfc(input.title) ?? "",
    description: nfc(input.description) ?? "",
    kind: nfc(input.kind) ?? "other",
    country: nfc(input.country ?? null),
    city: nfc(input.city ?? null),
  };
}

function stableStringify(value: Record<string, string | null>): string {
  const sorted: Record<string, string | null> = {};
  for (const k of Object.keys(value).sort()) {
    sorted[k] = value[k];
  }
  return JSON.stringify(sorted);
}

export async function canonicalContentHash(
  input: ContentHashInput,
): Promise<string> {
  const canonical = canonicalizeContentInput(input);
  const bytes = new TextEncoder().encode(stableStringify(canonical));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
