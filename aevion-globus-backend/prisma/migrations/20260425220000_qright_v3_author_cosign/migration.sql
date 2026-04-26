-- v3 (author co-signing): the certificate is also signed by an Ed25519
-- keypair held by the author client-side (browser IndexedDB + exportable
-- backup). The server never sees the private key — it only verifies the
-- signature against `contentHash`.
--
-- Threat: if AEVION is compromised, attacker has shard 2 + can fetch
-- shard 3 from our /witness endpoint, reconstruct AEVION's Ed25519 key,
-- and forge new certificates that look authentic. Author co-signing
-- closes that gap: forging a cert in a specific user's name additionally
-- requires that user's private key, which AEVION has never held.
--
-- Pre-v3 rows: NULL columns. /verify reports `present: false` and treats
-- single-party signing as the legacy default.
ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "authorPublicKey" TEXT;
ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "authorSignature" TEXT;
ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "authorKeyAlgo" TEXT;
