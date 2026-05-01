-- Bureau Phase A: Verified tier
--
-- Adds KYC + payment-gated identity verification on top of the anonymous
-- Qright certificate. Free certs stay anonymous (default) and have full
-- cryptographic strength; Verified certs additionally carry a real-name
-- attestation that the bureau will sign — useful evidence in IP disputes
-- where the author's identity is contested.
--
-- Schema is additive and nullable so pre-Bureau rows remain valid; the
-- verify endpoint reports authorVerificationLevel: "anonymous" for them.

ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "authorVerificationLevel" TEXT NOT NULL DEFAULT 'anonymous';
ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "authorVerificationProvider" TEXT;
ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "authorVerificationRef" TEXT;
ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "authorVerifiedAt" TIMESTAMPTZ;
ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "authorVerifiedName" TEXT;

-- Full audit trail for KYC + payment events. Decoupled from
-- IPCertificate because a single user verification can stamp many
-- certificates.
CREATE TABLE IF NOT EXISTS "BureauVerification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "email" TEXT,
  "kycProvider" TEXT NOT NULL,
  "kycSessionId" TEXT NOT NULL,
  "kycStatus" TEXT NOT NULL DEFAULT 'pending',
  "kycDecision" TEXT,
  "kycVerifiedName" TEXT,
  "kycVerifiedDocType" TEXT,
  "kycVerifiedCountry" TEXT,
  "kycRawJson" JSONB,
  "paymentProvider" TEXT,
  "paymentIntentId" TEXT,
  "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
  "paymentAmountCents" INTEGER,
  "paymentCurrency" TEXT,
  "paymentRawJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "BureauVerification_userId_idx"
  ON "BureauVerification" ("userId");
CREATE INDEX IF NOT EXISTS "BureauVerification_kycSessionId_idx"
  ON "BureauVerification" ("kycSessionId");
