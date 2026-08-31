// AEVION Trust Score — OpenTimestamps (Bitcoin) anchoring.
//
// The Ed25519 attestation proves *AEVION asserted this value* and *it was not
// altered*. It does not, by itself, prove *when* — `asOf` is a server-asserted
// time. This layer closes that gap: it submits the attestation's contentHash
// (the exact bytes the Ed25519 signature covers) to the OpenTimestamps calendar
// network, which anchors it into the Bitcoin blockchain. The resulting `.ots`
// proof lets anyone confirm — with no trust in AEVION at all — that this hash
// existed no later than a specific Bitcoin block.
//
// The two proofs compose over the SAME hash:
//   Ed25519 attestation → who + integrity   (AEVION's key signed this value)
//   OpenTimestamps proof → trustless time    (this value existed at block N)
//
// Stateless by design: the `.ots` proof IS the artifact (like a detached .ots
// file). `anchor` returns it; the caller keeps it; `anchor/verify` takes the
// snapshot + proof back. No DB table or upgrade cron is added here — Bitcoin
// confirmation is pulled on demand at verify time via upgradeProof().
import {
  signedTrustScore,
  verifySignedTrustScore,
  type SignedTrustScore,
  type VerifyResult,
} from "./trustSignature";
import {
  stampHash,
  upgradeProof,
  verifyProof,
  type AnchorStatus, ANCHOR_STATUS_MEANING, type AnchorStatusMeaning } from "./opentimestamps/anchor";

export interface TrustAnchor {
  status: AnchorStatus;
  /** the hash submitted to OpenTimestamps — equals snapshot.attestation.contentHash */
  contentHash: string;
  /** base64 of the serialized .ots proof (keep this; it upgrades to Bitcoin later) */
  otsProofB64: string | null;
  bitcoinBlockHeight: number | null;
  calendars: string[];
  error: string | null;
  note: string;
}

export interface AnchoredTrustScore {
  snapshot: SignedTrustScore;
  anchor: TrustAnchor;
}

/** Sign the current Trust Score and submit its hash to OpenTimestamps. */
export async function anchorTrustScore(asOf: string): Promise<AnchoredTrustScore> {
  const snapshot = signedTrustScore(asOf);
  const hash = snapshot.attestation.contentHash;
  const r = await stampHash(hash);
  return {
    snapshot,
    anchor: {
      status: r.status,
      contentHash: hash,
      otsProofB64: r.otsProof ? r.otsProof.toString("base64") : null,
      bitcoinBlockHeight: r.bitcoinBlockHeight,
      calendars: r.calendars,
      error: r.error,
      // ⚠️ Ветвь по статусу — ЯВНАЯ, без «иначе». Раньше последняя ветка ловила
      // всё незнакомое и объявляла это сетевым сбоем календарей. Пока значений
      // было три, она попадала; с добавлением "not-submitted" такой «иначе»
      // выдал бы уверенное и ложное объяснение — тот самый класс, ради которого
      // всё это и правится.
      note:
        r.status === "pending"
          ? "Submitted to OpenTimestamps calendars. Bitcoin confirmation follows in ~1-6h. Keep otsProofB64."
          : r.status === "bitcoin-confirmed"
            ? "Anchored to Bitcoin — the Trust Score hash is trustlessly timestamped."
            : r.status === "failed"
              ? "Calendar submission failed (network). The Ed25519 signature is unaffected; retry the anchor."
              : "No proof to evaluate — see error for what was missing.",
    },
  };
}

export interface AnchorVerifyResult {
  /** Ed25519 attestation check (value untampered + AEVION's platform key). */
  ed25519: VerifyResult;
  ots: {
    /** true = proof is Bitcoin-confirmed AND verifies against the block header for the signed hash */
    verified: boolean;
    status: AnchorStatus;
    /** Что это значит и что делать — рядом со словом, а не в документации. */
    statusMeaning: AnchorStatusMeaning;
    /** true if this call promoted the proof from pending → Bitcoin-confirmed */
    upgraded: boolean;
    bitcoinBlockHeight: number | null;
    attestations: string[];
    /** possibly-upgraded proof to re-persist in place of the old one */
    otsProofB64: string | null;
    error: string | null;
  };
  /** overall: Ed25519 valid AND anchored hash is Bitcoin-verified for that exact value */
  fullyProven: boolean;
  note: string;
}

/**
 * Verify a previously-anchored snapshot end to end:
 *  1. Ed25519 — the snapshot value is untampered and signed by AEVION's key.
 *  2. OpenTimestamps — the attestation's contentHash is Bitcoin-anchored
 *     (upgrading a still-pending proof on the fly), verified against the
 *     block header. Both checks are over the same hash, so a confirmed anchor
 *     is an anchor of exactly the Ed25519-signed value.
 */
export async function verifyAnchoredTrustScore(body: unknown): Promise<AnchorVerifyResult> {
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const snapshot = obj.snapshot;
  const otsProofB64 = typeof obj.otsProofB64 === "string" ? obj.otsProofB64 : null;

  const ed25519 = verifySignedTrustScore(snapshot);

  const otsFail = (error: string, status: AnchorStatus = "not-submitted"): AnchorVerifyResult => ({
    ed25519,
    ots: { verified: false, status, statusMeaning: ANCHOR_STATUS_MEANING[status], upgraded: false, bitcoinBlockHeight: null, attestations: [], otsProofB64, error },
    fullyProven: false,
    note: "Not yet fully proven — see ed25519 and ots for what is missing.",
  });

  if (!otsProofB64) return otsFail("missing otsProofB64");
  // The hash the proof must anchor is the one the Ed25519 signature covers.
  const hash =
    snapshot && typeof snapshot === "object"
      ? (snapshot as Record<string, any>).attestation?.contentHash
      : undefined;
  if (typeof hash !== "string") return otsFail("snapshot has no attestation.contentHash");

  // ⚠️ `Buffer.from(x, "base64")` НЕ БРОСАЕТ: недопустимые символы молча
  // отбрасываются, поэтому прежний try/catch не мог сработать никогда — защита
  // была на вид, а мусор проходил дальше и падал уже в проверке доказательства.
  // Спрашиваем формат прямо.
  // ⚠️ Нормализуем ДО проверки, и это не удобство, а исправление регрессии,
  // которую я же и внёс. `Buffer.from(x, "base64")` в Node принимает URL-safe
  // (`-` и `_`) и декодирует ИДЕНТИЧНО стандартному — проверено опытом. Значит
  // до появления строгого шаблона такие доказательства проверялись успешно, а
  // после стали получать «не является корректным base64»: формально верный и
  // бесполезный ответ для третьей стороны, которую мы сами зовём проверять нас.
  //
  // Урок общий: ужесточение поверх ТЕРПИМОГО декодера отсекает входы, которые
  // раньше работали. Прежде чем сузить приём, спроси, что принимал слой ниже.
  const b64 = otsProofB64
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const looksBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(b64);
  if (!looksBase64) return otsFail("otsProofB64 is not valid base64");
  const proof = Buffer.from(b64, "base64");
  if (proof.length === 0) return otsFail("otsProofB64 decodes to nothing");

  // Pull any fresh Bitcoin attestation (idempotent — no-op if already confirmed).
  const up = await upgradeProof(proof);
  const currentProof = up.otsProof ?? proof;
  const v = await verifyProof(hash, currentProof);

  const verified = v.ok && ed25519.valid;
  // Статус и его пояснение считаются из ОДНОГО значения: разойтись они
  // не могут по устройству, а не по внимательности.
  const otsStatus: AnchorStatus =
    v.reason === "proof-error"
      ? "invalid"
      : v.bitcoinBlockHeight !== null
        ? "bitcoin-confirmed"
        : "pending";

  return {
    ed25519,
    ots: {
      verified: v.ok,
      // Порядок ветвей важен: сперва спрашиваем, ПРОШЛА ли проверка, и только
      // потом — подтверждена ли она Bitcoin. Прежняя версия смотрела лишь на
      // высоту блока, поэтому непрошедшее доказательство получало "pending".
      // Различаем по ПРИЧИНЕ из источника, а не по `ok`: он ложен и когда
      // привязки к блоку ещё нет (честное ожидание), и когда доказательство
      // не сходится вовсе. Первое — «повторите позже», второе — «ждать
      // бессмысленно», и звать оба "pending" значит советовать ждать зря.
      status: otsStatus,
      statusMeaning: ANCHOR_STATUS_MEANING[otsStatus],
      upgraded: up.upgraded,
      bitcoinBlockHeight: v.bitcoinBlockHeight,
      attestations: v.attestations,
      otsProofB64: currentProof.toString("base64"),
      error: v.error,
    },
    fullyProven: verified,
    note: verified
      ? `Fully proven: AEVION's Ed25519 key signed this exact Trust Score, and its hash is Bitcoin-anchored at block ${v.bitcoinBlockHeight}.`
      : !ed25519.valid
        ? "Ed25519 check failed — the snapshot value or signature does not verify."
        : v.reason === "proof-error"
          ? "Ed25519 valid, but the OpenTimestamps proof does not verify against this hash — see ots.error. Waiting will not help."
          : "Ed25519 valid, but the Bitcoin anchor is not confirmed yet (pending). Re-verify later once a block attestation appears.",
  };
}
