// QSkyway — Bitcoin-anchoring the airspace layer's content hash.
//
// The Ed25519 attestation over the ceiling layer proves *AEVION signed this
// exact rule set*. It does not prove *when*: the edition date comes from the
// regulator's own field, but "we were already routing against it on date X" is
// asserted by our server's clock and nothing else. For a claim whose whole value
// is regulatory ("this corridor obeyed the airspace as published at the time"),
// self-asserted time is the weak link.
//
// So the same contentHash goes to the OpenTimestamps calendar network and, from
// there, into Bitcoin. Two proofs over ONE hash:
//   Ed25519  → who + integrity  (AEVION signed this exact cell set and edition)
//   OpenTimestamps → trustless time (this rule set existed no later than block N)
//
// Stateless, exactly like the Trust Score anchor: the `.ots` proof IS the
// artifact. We hand it back, the caller keeps it, and a later verify upgrades a
// still-pending proof on the fly. No table, no cron.

import { AIRSPACE, airspaceContentHash } from "./qskyway.airspace";
import { stampHash, upgradeProof, verifyProof, type AnchorStatus } from "../lib/opentimestamps/anchor";

export interface AirspaceAnchor {
  status: AnchorStatus;
  city: string;
  authority: string;
  /** the regulator's own edition marker, carried alongside the anchored hash */
  effective: string;
  /** the hash submitted — identical to the one the Ed25519 signature covers */
  contentHash: string;
  otsProofB64: string | null;
  bitcoinBlockHeight: number | null;
  calendars: string[];
  error: string | null;
  note: string;
}

export async function anchorAirspace(cityId: string): Promise<AirspaceAnchor | null> {
  const src = AIRSPACE[cityId];
  if (!src) return null;
  const contentHash = airspaceContentHash(src);
  const r = await stampHash(contentHash);
  return {
    status: r.status,
    city: cityId,
    authority: src.authority,
    effective: src.effective,
    contentHash,
    otsProofB64: r.otsProof ? r.otsProof.toString("base64") : null,
    bitcoinBlockHeight: r.bitcoinBlockHeight,
    calendars: r.calendars,
    error: r.error,
    note:
      r.status === "pending"
        ? "Отправлено в календари OpenTimestamps. Подтверждение Bitcoin приходит через ~1-6ч — сохраните otsProofB64 и вернитесь на /airspace/anchor/verify."
        : r.status === "bitcoin-confirmed"
          ? "Слой ограничений привязан к Bitcoin — дата использования этой редакции доказуема без доверия к нам."
          : "Отправка в календари не удалась (сеть). Подпись Ed25519 не затронута; якорь можно повторить позже.",
  };
}

export interface AirspaceAnchorVerify {
  city: string | null;
  /** the snapshot currently served still hashes to the anchored value */
  matchesCurrentSnapshot: boolean;
  ots: {
    verified: boolean;
    status: AnchorStatus;
    upgraded: boolean;
    bitcoinBlockHeight: number | null;
    attestations: string[];
    otsProofB64: string | null;
    error: string | null;
  };
  fullyProven: boolean;
  note: string;
}

/**
 * Verify an anchored airspace layer.
 *
 * Deliberately checks two separate things and reports them separately:
 *  - the OTS proof anchors the given hash into Bitcoin (trustless time), and
 *  - that hash is still the hash of the snapshot we serve today.
 *
 * They come apart on purpose. Once the FAA reissues and we regenerate, an old
 * proof stays perfectly valid for the edition it covered while no longer
 * matching what we serve — that is a correct historical record, not a failure,
 * and collapsing both into one boolean would hide it.
 */
export async function verifyAnchoredAirspace(body: unknown): Promise<AirspaceAnchorVerify> {
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const city = typeof obj.city === "string" ? obj.city : null;
  const contentHash = typeof obj.contentHash === "string" ? obj.contentHash : null;
  const otsProofB64 = typeof obj.otsProofB64 === "string" ? obj.otsProofB64 : null;

  const fail = (error: string): AirspaceAnchorVerify => ({
    city,
    matchesCurrentSnapshot: false,
    ots: { verified: false, status: "pending", upgraded: false, bitcoinBlockHeight: null, attestations: [], otsProofB64, error },
    fullyProven: false,
    note: "Проверка не завершена — см. поле error.",
  });

  if (!contentHash) return fail("нужен contentHash");
  if (!otsProofB64) return fail("нужен otsProofB64");

  const src = city ? AIRSPACE[city] : undefined;
  const matchesCurrentSnapshot = Boolean(src) && airspaceContentHash(src!) === contentHash;

  let proof: Buffer;
  try {
    proof = Buffer.from(otsProofB64, "base64");
  } catch {
    return fail("otsProofB64 не является корректным base64");
  }

  const up = await upgradeProof(proof);
  const currentProof = up.otsProof ?? proof;
  const v = await verifyProof(contentHash, currentProof);

  return {
    city,
    matchesCurrentSnapshot,
    ots: {
      verified: v.ok,
      status: v.bitcoinBlockHeight !== null ? "bitcoin-confirmed" : "pending",
      upgraded: up.upgraded,
      bitcoinBlockHeight: v.bitcoinBlockHeight,
      attestations: v.attestations,
      otsProofB64: currentProof.toString("base64"),
      error: v.error,
    },
    fullyProven: v.ok,
    note: !v.ok
      ? "Bitcoin-подтверждение ещё не получено (pending) либо пруф не сходится — повторите позже."
      : matchesCurrentSnapshot
        ? `Доказано: этот набор ограничений существовал не позднее блока ${v.bitcoinBlockHeight} и совпадает с тем, что отдаётся сейчас.`
        : `Доказано для прошлой редакции: хэш привязан к блоку ${v.bitcoinBlockHeight}, но текущий снимок уже другой (регулятор перевыпустил карту). Это корректная историческая запись, а не ошибка.`,
  };
}
