-- Bureau Phase C scaffold — Notarized tier
--
-- Stores licensed notaries who have agreed to co-sign AEVION certificates
-- under the Notarized tier. Each notary holds their own Ed25519 keypair
-- and is registered manually by AEVION admin after the partnership
-- agreement is signed.
--
-- This migration sets up the data model. The actual notarize workflow
-- (assign cert to notary → notary signs → verify shows notary sig) is a
-- follow-up PR. The schema is shaped today so verify code can read
-- notarySignature without breaking when no rows exist.

CREATE TABLE IF NOT EXISTS "BureauNotary" (
  "id" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL UNIQUE,
  "jurisdiction" TEXT NOT NULL,
  "city" TEXT,
  "publicKeyEd25519" TEXT NOT NULL,
  "publicKeyFingerprint" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contractSignedAt" TIMESTAMPTZ,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deactivatedAt" TIMESTAMPTZ,
  "monthlyVolumeLimit" INTEGER NOT NULL DEFAULT 200
);

CREATE INDEX IF NOT EXISTS "BureauNotary_jurisdiction_idx" ON "BureauNotary" ("jurisdiction");

CREATE TABLE IF NOT EXISTS "BureauNotarySignature" (
  "id" TEXT PRIMARY KEY,
  "notaryId" TEXT NOT NULL REFERENCES "BureauNotary"("id"),
  "certId" TEXT NOT NULL,
  "signedHash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "notaryRegistryRef" TEXT,
  "signedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revokedAt" TIMESTAMPTZ,
  "revocationReason" TEXT
);

CREATE INDEX IF NOT EXISTS "BureauNotarySignature_certId_idx" ON "BureauNotarySignature" ("certId");
CREATE INDEX IF NOT EXISTS "BureauNotarySignature_notaryId_idx" ON "BureauNotarySignature" ("notaryId");

ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "notarySignatureId" TEXT;
