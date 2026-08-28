/**
 * OpenTimestamps anchor — submits content hashes to the OT calendar network
 * and later upgrades pending proofs to Bitcoin-confirmed attestations.
 *
 * Produces a binary `.ots` proof that anyone can verify offline against the
 * Bitcoin blockchain. This is what turns "our DB says 2026-04-24" into a
 * third-party-verifiable claim.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// The upstream library ships without TS types; we bridge through `any`.
import * as OpenTimestamps from "opentimestamps";

export type AnchorStatus =
  | "pending"            // submitted to OT calendars, no Bitcoin attestation yet
  | "bitcoin-confirmed"  // at least one BitcoinBlockHeaderAttestation present
  | "failed"             // network failure during stamp; proof not created
  // Нечего оценивать: доказательство не прислали, прислали не-base64 или у
  // снимка нет хеша. Раньше эти случаи докладывались как "pending", то есть
  // «подано, ждём Bitcoin» — и это про продукт о доказуемости было хуже
  // отсутствия поля: снаружи неотличимо от честного ожидания.
  | "not-submitted"
  // Доказательство прислали, и оно проверку НЕ прошло. Раньше этот случай
  // тоже докладывался как "pending": статус считался по высоте блока и не
  // смотрел на исход проверки вовсе. Снаружи «недействительно» выглядело
  // как «ещё не подтвердилось, зайдите позже» — ложь в выгодную нам сторону.
  | "invalid";

/**
 * Что значит статус и что делать человеку — рядом с самим статусом.
 *
 * ПОВОД. 29.08.2026 мы завели два новых значения (`invalid`, `not-submitted`),
 * потому что отказ прежде докладывался как ожидание. Но продукт обещает
 * «проверьте сами», а слово, которое получает третья сторона, не объяснено
 * нигде: ни в ответе, ни в рецепте самопроверки. Различие «подождите» против
 * «ждать бессмысленно» — как раз то, ради чего всё и правилось; оставить его
 * невысказанным значит сделать работу наполовину.
 *
 * ⚠️ Тип `Record<AnchorStatus, …>` здесь не косметика: он ЗАСТАВИТ автора
 * нового статуса написать пояснение — иначе сборка не пройдёт. Проверка
 * временем компиляции надёжнее сторожа, потому что её нельзя забыть запустить.
 */
export interface AnchorStatusMeaning {
  /** Что произошло. */
  ru: string;
  en: string;
  /** Что делать дальше — короткой строкой, без «см. документацию». */
  nextRu: string;
  nextEn: string;
}

export const ANCHOR_STATUS_MEANING: Record<AnchorStatus, AnchorStatusMeaning> = {
  "bitcoin-confirmed": {
    ru: "Хэш привязан к блоку Bitcoin.",
    en: "The hash is anchored to a Bitcoin block.",
    nextRu: "Ничего делать не нужно — это доказано.",
    nextEn: "Nothing to do — this is proven.",
  },
  pending: {
    ru: "Доказательство подано в календари, привязки к блоку Bitcoin ещё нет.",
    en: "Submitted to the calendars; no Bitcoin block attestation yet.",
    nextRu: "Повторите проверку позже — обычно занимает от часа до шести.",
    nextEn: "Re-verify later — this usually takes one to six hours.",
  },
  invalid: {
    ru: "Доказательство не сходится с этим хэшем.",
    en: "The proof does not check out against this hash.",
    nextRu: "Ждать бессмысленно: проверьте, тот ли хэш и то ли доказательство.",
    nextEn: "Waiting will not help: check that the hash and the proof belong together.",
  },
  "not-submitted": {
    ru: "Оценивать нечего: доказательство не прислали или его формат негоден.",
    en: "Nothing to evaluate: no proof was supplied, or its format is unusable.",
    nextRu: "Пришлите otsProofB64 и contentHash — см. поле error.",
    nextEn: "Supply otsProofB64 and contentHash — see the error field.",
  },
  failed: {
    ru: "Сбой сети при обращении к календарям; доказательство не создано.",
    en: "Network failure while reaching the calendars; no proof was created.",
    nextRu: "Повторите привязку — подпись Ed25519 этим не затронута.",
    nextEn: "Retry the anchor — the Ed25519 signature is unaffected.",
  },
};

export interface AnchorStampResult {
  status: AnchorStatus;
  otsProof: Buffer | null;       // serialized .ots payload
  bitcoinBlockHeight: number | null;
  calendars: string[];           // calendar URLs that accepted the submission
  error: string | null;
}

export interface AnchorUpgradeResult {
  upgraded: boolean;              // true = proof now contains BitcoinBlockHeaderAttestation
  status: AnchorStatus;
  otsProof: Buffer | null;
  bitcoinBlockHeight: number | null;
  error: string | null;
}

export interface AnchorVerifyResult {
  ok: boolean;
  bitcoinBlockHeight: number | null;
  attestations: string[];         // human-readable list
  error: string | null;
  /**
   * ПОЧЕМУ не получилось — различитель, без которого `ok:false` двусмыслен.
   *
   * `ok` ложен в ДВУХ разных случаях: доказательство ещё не привязано к блоку
   * (честное ожидание, повторите позже) и доказательство не сходится вовсе
   * (ждать бессмысленно). Раньше вызывающие не могли их отличить и звали оба
   * "pending" — то есть недействительному доказательству отвечали «зайдите
   * позже». Угадывать по тексту ошибки нельзя: он приходит из чужой
   * библиотеки и меняется с её версией.
   */
  reason: "awaiting-bitcoin" | "proof-error" | null;
}

function extractBitcoinHeight(detached: any): number | null {
  // Walk all attestations in the timestamp tree. Any BitcoinBlockHeaderAttestation
  // counts. If multiple are present we keep the earliest (lowest height).
  let earliest: number | null = null;
  try {
    const attestations = detached.timestamp.allAttestations
      ? detached.timestamp.allAttestations()
      : new Map<Buffer, any>();
    for (const [, att] of attestations) {
      const name = att?.constructor?.name ?? "";
      if (name.includes("BitcoinBlockHeader") && typeof att.height === "number") {
        if (earliest === null || att.height < earliest) earliest = att.height;
      }
    }
  } catch {
    return null;
  }
  return earliest;
}

function summarizeAttestations(detached: any): string[] {
  const out: string[] = [];
  try {
    const attestations = detached.timestamp.allAttestations
      ? detached.timestamp.allAttestations()
      : new Map<Buffer, any>();
    for (const [, att] of attestations) {
      const name = att?.constructor?.name ?? "Attestation";
      if (name.includes("BitcoinBlockHeader")) {
        out.push(`BitcoinBlockHeaderAttestation(${att.height})`);
      } else if (name.includes("Pending")) {
        const uri = att?.uri ? ` ${att.uri}` : "";
        out.push(`PendingAttestation${uri}`);
      } else {
        out.push(name);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Submit a SHA-256 content hash to OT calendars. Network call — may take
 * 1-5s. Returns a proof blob to persist. Callers should treat this as
 * fire-and-forget (don't block the user response on it).
 */
export async function stampHash(
  contentHashHex: string,
): Promise<AnchorStampResult> {
  if (!/^[0-9a-f]{64}$/i.test(contentHashHex)) {
    return {
      status: "failed",
      otsProof: null,
      bitcoinBlockHeight: null,
      calendars: [],
      error: "content hash must be 64 hex chars (SHA-256)",
    };
  }
  try {
    const Ots: any = OpenTimestamps;
    const hash = Buffer.from(contentHashHex, "hex");
    const detached = Ots.DetachedTimestampFile.fromHash(new Ots.Ops.OpSHA256(), hash);
    await Ots.stamp(detached);
    const proof = Buffer.from(detached.serializeToBytes());
    const height = extractBitcoinHeight(detached);
    return {
      status: height === null ? "pending" : "bitcoin-confirmed",
      otsProof: proof,
      bitcoinBlockHeight: height,
      calendars: ["alice.btc.calendar.opentimestamps.org", "bob.btc.calendar.opentimestamps.org", "finney.calendar.eternitywall.com"],
      error: null,
    };
  } catch (err: unknown) {
    return {
      status: "failed",
      otsProof: null,
      bitcoinBlockHeight: null,
      calendars: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Try to upgrade a pending proof with Bitcoin attestations. Idempotent —
 * if the proof already has Bitcoin attestations, returns them without
 * re-requesting.
 */
export async function upgradeProof(
  otsProof: Buffer,
): Promise<AnchorUpgradeResult> {
  try {
    const Ots: any = OpenTimestamps;
    const detached = Ots.DetachedTimestampFile.deserialize(otsProof);
    const before = extractBitcoinHeight(detached);
    if (before !== null) {
      return {
        upgraded: false,
        status: "bitcoin-confirmed",
        otsProof,
        bitcoinBlockHeight: before,
        error: null,
      };
    }
    await Ots.upgrade(detached);
    const after = extractBitcoinHeight(detached);
    const newProof = Buffer.from(detached.serializeToBytes());
    return {
      upgraded: after !== null,
      status: after === null ? "pending" : "bitcoin-confirmed",
      otsProof: newProof,
      bitcoinBlockHeight: after,
      error: null,
    };
  } catch (err: unknown) {
    return {
      upgraded: false,
      status: "pending",
      otsProof,
      bitcoinBlockHeight: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify that `otsProof` is a valid Bitcoin-anchored timestamp for the
 * given content hash. Network-optional: if the proof already contains
 * a BitcoinBlockHeaderAttestation, the height is trusted; the upstream
 * library's `verify()` additionally consults block explorers to confirm
 * the Merkle root matches the block header at that height.
 */
export async function verifyProof(
  contentHashHex: string,
  otsProof: Buffer,
): Promise<AnchorVerifyResult> {
  try {
    const Ots: any = OpenTimestamps;
    const hash = Buffer.from(contentHashHex, "hex");
    const detached = Ots.DetachedTimestampFile.fromHash(new Ots.Ops.OpSHA256(), hash);
    const detachedOts = Ots.DetachedTimestampFile.deserialize(otsProof);
    const height = extractBitcoinHeight(detachedOts);
    const summary = summarizeAttestations(detachedOts);
    if (height === null) {
      return {
        ok: false,
        bitcoinBlockHeight: null,
        attestations: summary,
        error: "no Bitcoin attestation yet (still pending)",
        reason: "awaiting-bitcoin",
      };
    }
    // verify() returns a Map<Buffer, number> of attestations verified against
    // block explorers. It throws on mismatch.
    await Ots.verify(detachedOts, detached);
    return {
      ok: true,
      bitcoinBlockHeight: height,
      attestations: summary,
      error: null,
      reason: null,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      bitcoinBlockHeight: null,
      attestations: [],
      error: err instanceof Error ? err.message : String(err),
      reason: "proof-error",
    };
  }
}
