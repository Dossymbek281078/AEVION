import crypto from "crypto";
import { stableStringify } from "./stableStringify";

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

export function canonicalizeContentInput(
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

export function canonicalContentHash(input: ContentHashInput): string {
  const canonical = canonicalizeContentInput(input);
  return crypto
    .createHash("sha256")
    .update(stableStringify(canonical))
    .digest("hex");
}
