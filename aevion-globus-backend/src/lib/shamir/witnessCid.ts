import crypto from "crypto";

/**
 * Compute an IPFS-compatible CID v1 (base32, dag-json codec) over a
 * canonical serialization of the shard. Pure function: same shard always
 * produces the same CID.
 *
 * Why: the CID is a content-addressable identifier that a third party can
 * use to check "is this shard authentic and unmodified since publication?"
 * without trusting AEVION. If the witness node is ever migrated to a real
 * IPFS/Filecoin pin, this CID is the exact handle the user will query.
 *
 * Format:
 *   <cidv1-prefix=0x01><codec-dag-json=0x0129><multihash-sha2-256=0x1220><hash>
 * Encoded in RFC4648 base32 lowercase, no padding, with 'b' multibase prefix.
 */
export function computeWitnessCid(shard: {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
}): string {
  // Canonical JSON: fixed key order so the CID is deterministic.
  const canonical = JSON.stringify({
    hmac: shard.hmac,
    hmacKeyVersion: shard.hmacKeyVersion,
    index: shard.index,
    sssShare: shard.sssShare,
  });
  const digest = crypto.createHash("sha256").update(canonical).digest();

  // Multihash: 0x12 = sha2-256, 0x20 = 32-byte length.
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), digest]);

  // CID v1 header:
  //   version = 0x01
  //   codec   = 0x0129 (dag-json, varint-encoded as 0xa9, 0x02)
  const codecDagJson = Buffer.from([0xa9, 0x02]);
  const cidBytes = Buffer.concat([
    Buffer.from([0x01]),
    codecDagJson,
    multihash,
  ]);

  return "b" + base32LowerNoPad(cidBytes);
}

// RFC 4648 base32, lowercase, no padding. Small inline implementation so
// we don't pull a dependency just for CID encoding.
function base32LowerNoPad(buf: Buffer): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 0x1f];
  }
  return out;
}
