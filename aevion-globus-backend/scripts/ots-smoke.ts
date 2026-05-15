import { stampHash, verifyProof } from "../src/lib/opentimestamps/anchor";
import crypto from "crypto";

async function main() {
  const hash = crypto
    .createHash("sha256")
    .update("AEVION prod-grade smoke " + Date.now())
    .digest("hex");
  console.log("stamping hash:", hash);
  const t0 = Date.now();
  const r = await stampHash(hash);
  console.log("elapsed", Date.now() - t0, "ms");
  console.log("status:", r.status);
  console.log("bitcoinBlockHeight:", r.bitcoinBlockHeight);
  console.log("proof size:", r.otsProof?.length, "bytes");
  console.log("error:", r.error);
  if (r.otsProof) {
    const v = await verifyProof(hash, r.otsProof);
    console.log(
      "verify ok:",
      v.ok,
      "attestations:",
      v.attestations,
      "error:",
      v.error,
    );
  }
}

main().catch((e) => {
  console.error("THROW:", e instanceof Error ? e.message : e);
  process.exit(1);
});
