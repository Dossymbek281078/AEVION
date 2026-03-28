import crypto from "crypto";
import { stableStringify } from "./stableStringify";

export type MediaDescriptor = {
  title?: string;
  artist?: string;
  durationSec?: number;
  isrc?: string;
  externalId?: string;
};

export type MediaIndex = {
  kind: "planet_media_index_v1";
  artifactType: "movie" | "music";
  fingerprintNormHash: string;
  shingles: string[];
  descriptorKeys: string[];
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/** Normalize opaque fingerprint: trim, NFC; hex-64 → lowercase; else lowercase for stable compare. */
export function normalizeMediaFingerprint(raw: string): string {
  const t = raw.trim().normalize("NFC");
  if (!t) return "";
  if (/^[a-f0-9]{64}$/i.test(t)) return t.toLowerCase();
  return t.toLowerCase();
}

function normalizeDescriptor(
  d: MediaDescriptor | undefined,
  submissionTitle: string | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const title = (d?.title ?? submissionTitle ?? "").trim();
  const artist = (d?.artist ?? "").trim();
  if (title) out.title = title.normalize("NFC").toLowerCase();
  if (artist) out.artist = artist.normalize("NFC").toLowerCase();
  if (typeof d?.durationSec === "number" && Number.isFinite(d.durationSec) && d.durationSec >= 0) {
    out.durationSecBucket = Math.round(d.durationSec * 10) / 10;
  }
  if (d?.isrc) {
    const isrc = String(d.isrc).trim().replace(/\s+/g, "").toUpperCase();
    if (isrc) out.isrc = isrc;
  }
  if (d?.externalId) {
    const e = String(d.externalId).trim();
    if (e) out.externalId = e.normalize("NFC").toLowerCase();
  }
  return out;
}

function buildShingleSource(fingerprintNorm: string, desc: Record<string, unknown>): string {
  const parts = [fingerprintNorm];
  if (desc.title) parts.push(String(desc.title));
  if (desc.artist) parts.push(String(desc.artist));
  if (desc.isrc) parts.push(String(desc.isrc));
  if (desc.externalId) parts.push(String(desc.externalId));
  return parts.join("|");
}

function shinglesFromText(text: string, k: number): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t.length) return [];
  if (t.length < k) return [t];
  const set = new Set<string>();
  for (let i = 0; i <= t.length - k; i++) set.add(t.slice(i, i + k));
  return Array.from(set).sort();
}

/**
 * Stable canonical input for movie/music: structured descriptor + normalized fingerprint.
 * Similarity uses character 5-grams over fingerprint + metadata (not raw bytes).
 */
export function canonicalizeMediaInput(params: {
  artifactType: "movie" | "music";
  mediaFingerprint: string;
  mediaDescriptor?: MediaDescriptor;
  submissionTitle?: string;
}): { inputSetHash: string; mediaIndex: MediaIndex } {
  const fpNorm = normalizeMediaFingerprint(params.mediaFingerprint);
  if (!fpNorm) {
    throw new Error("mediaFingerprint is empty after normalization");
  }
  const desc = normalizeDescriptor(params.mediaDescriptor, params.submissionTitle);
  const fingerprintNormHash = sha256Hex(fpNorm);
  const canonicalBody = {
    kind: "planet_media_input_v1",
    artifactType: params.artifactType,
    fingerprintNormHash,
    descriptor: desc,
  };
  const inputSetHash = sha256Hex(stableStringify(canonicalBody));
  const text = buildShingleSource(fpNorm, desc);
  const shingles = shinglesFromText(text, 5);
  const mediaIndex: MediaIndex = {
    kind: "planet_media_index_v1",
    artifactType: params.artifactType,
    fingerprintNormHash,
    shingles,
    descriptorKeys: Object.keys(desc).sort(),
  };
  return { inputSetHash, mediaIndex };
}

export function jaccardStringSets(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni === 0 ? 0 : inter / uni;
}
