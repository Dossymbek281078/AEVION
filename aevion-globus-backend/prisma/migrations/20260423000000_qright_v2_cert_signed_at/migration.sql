-- v2.1: store signedAt so GET /verify/:certId can re-verify signatureHmac.
-- Pre-v2 rows will have NULL signedAt — verify endpoint reports the signature
-- check as "NO_SIGNED_AT" for them (not an integrity failure, just unverifiable).
ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMPTZ;
