-- Bureau Phase B — organizations (B2B foundation)
--
-- Lets a law firm, agency, or group of co-authors create an organization
-- under which they hold AEVION certificates collectively. Pricing for
-- enterprise tiers and bulk-verified workflows is layered on top of this
-- table later; right now it just records membership and ownership.
--
-- Certificates and verifications optionally point at an org; legacy
-- single-user rows keep orgId NULL and stay valid.

CREATE TABLE IF NOT EXISTS "BureauOrganization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "ownerUserId" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "billingEmail" TEXT,
  "billingCountry" TEXT
);

CREATE TABLE IF NOT EXISTS "BureauMember" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "BureauOrganization"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("orgId", "userId")
);

CREATE INDEX IF NOT EXISTS "BureauMember_userId_idx" ON "BureauMember" ("userId");

CREATE TABLE IF NOT EXISTS "BureauOrgInvite" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "BureauOrganization"("id") ON DELETE CASCADE,
  "invitedEmail" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "acceptedAt" TIMESTAMPTZ,
  "acceptedByUserId" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "BureauOrgInvite_orgId_idx" ON "BureauOrgInvite" ("orgId");
CREATE INDEX IF NOT EXISTS "BureauOrgInvite_invitedEmail_idx" ON "BureauOrgInvite" ("invitedEmail");

ALTER TABLE "IPCertificate"
  ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "BureauVerification"
  ADD COLUMN IF NOT EXISTS "orgId" TEXT;
