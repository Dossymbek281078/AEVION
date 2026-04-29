-- Mark all pre-existing shield records as legacy (fake-SSS era).
-- New rows inserted after this migration will get DEFAULT false.
ALTER TABLE "QuantumShield" ADD COLUMN "legacy" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "QuantumShield" ALTER COLUMN "legacy" SET DEFAULT false;

-- HMAC key version for authenticated shards. Version 1 = SHARD_HMAC_SECRET.
ALTER TABLE "QuantumShield" ADD COLUMN "hmac_key_version" INTEGER NOT NULL DEFAULT 1;
