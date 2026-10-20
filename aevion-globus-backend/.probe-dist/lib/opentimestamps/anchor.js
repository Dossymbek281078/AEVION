"use strict";
/**
 * OpenTimestamps anchor — submits content hashes to the OT calendar network
 * and later upgrades pending proofs to Bitcoin-confirmed attestations.
 *
 * Produces a binary `.ots` proof that anyone can verify offline against the
 * Bitcoin blockchain. This is what turns "our DB says 2026-04-24" into a
 * third-party-verifiable claim.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANCHOR_STATUS_MEANING = void 0;
exports.stampHash = stampHash;
exports.upgradeProof = upgradeProof;
exports.verifyProof = verifyProof;
/* eslint-disable @typescript-eslint/no-explicit-any */
// The upstream library ships without TS types; we bridge through `any`.
const OpenTimestamps = __importStar(require("opentimestamps"));
exports.ANCHOR_STATUS_MEANING = {
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
function extractBitcoinHeight(detached) {
    // Walk all attestations in the timestamp tree. Any BitcoinBlockHeaderAttestation
    // counts. If multiple are present we keep the earliest (lowest height).
    let earliest = null;
    try {
        const attestations = detached.timestamp.allAttestations
            ? detached.timestamp.allAttestations()
            : new Map();
        for (const [, att] of attestations) {
            const name = att?.constructor?.name ?? "";
            if (name.includes("BitcoinBlockHeader") && typeof att.height === "number") {
                if (earliest === null || att.height < earliest)
                    earliest = att.height;
            }
        }
    }
    catch {
        return null;
    }
    return earliest;
}
function summarizeAttestations(detached) {
    const out = [];
    try {
        const attestations = detached.timestamp.allAttestations
            ? detached.timestamp.allAttestations()
            : new Map();
        for (const [, att] of attestations) {
            const name = att?.constructor?.name ?? "Attestation";
            if (name.includes("BitcoinBlockHeader")) {
                out.push(`BitcoinBlockHeaderAttestation(${att.height})`);
            }
            else if (name.includes("Pending")) {
                const uri = att?.uri ? ` ${att.uri}` : "";
                out.push(`PendingAttestation${uri}`);
            }
            else {
                out.push(name);
            }
        }
    }
    catch {
        /* ignore */
    }
    return out;
}
/**
 * Submit a SHA-256 content hash to OT calendars. Network call — may take
 * 1-5s. Returns a proof blob to persist. Callers should treat this as
 * fire-and-forget (don't block the user response on it).
 */
async function stampHash(contentHashHex) {
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
        const Ots = OpenTimestamps;
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
    }
    catch (err) {
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
async function upgradeProof(otsProof) {
    try {
        const Ots = OpenTimestamps;
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
    }
    catch (err) {
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
async function verifyProof(contentHashHex, otsProof) {
    try {
        const Ots = OpenTimestamps;
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
    }
    catch (err) {
        return {
            ok: false,
            bitcoinBlockHeight: null,
            attestations: [],
            error: err instanceof Error ? err.message : String(err),
            reason: "proof-error",
        };
    }
}
