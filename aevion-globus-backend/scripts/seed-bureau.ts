/**
 * Seed the Bureau registry with the same 8 demonstration certificates
 * that the in-memory store ships with — but this time written to
 * Postgres so they survive restarts and are visible to every process.
 *
 * Idempotent: if a cert with the same generated `id` already exists
 * (which won't happen for a fresh DB), the row is skipped via ON
 * CONFLICT DO NOTHING. Re-running adds another batch with new IDs —
 * easy to bulk up the registry for a richer demo.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run seed:bureau
 *   DATABASE_URL=postgres://... npm run seed:bureau -- --reset   # also wipes existing rows first
 */

import { Pool } from "pg";
import crypto from "crypto";

const SEED_LEGAL_BASIS = {
  framework: "AEVION Digital IP Bureau",
  version: "1.0",
  type: "Proof of Prior Art / Proof of Existence",
  international: [
    { name: "Berne Convention for the Protection of Literary and Artistic Works", article: "Article 5(2)", principle: "Copyright protection is automatic upon creation — no registration required." },
    { name: "WIPO Copyright Treaty (WCT)", year: 1996, principle: "Extends Berne Convention to digital works." },
    { name: "TRIPS Agreement (WTO)", principle: "Establishes minimum IP protection standards across 164 WTO member states." },
  ],
  digitalSignature: [
    { name: "eIDAS Regulation (EU)", number: "910/2014", scope: "European Union" },
    { name: "ESIGN Act (USA)", year: 2000, scope: "United States" },
    { name: "Law of RK on Electronic Digital Signature", number: "370-II", year: 2003, scope: "Kazakhstan" },
  ],
  disclaimer: "This certificate constitutes cryptographic proof of existence and authorship at the recorded time.",
};

const SEEDS: Array<{ title: string; kind: string; description: string; author: string; country: string; city: string; ago: number; verified: number }> = [
  { title: "Lullaby No. 7 in D Minor",        kind: "music",  description: "Original orchestral composition in 6/8 time, 4 minutes.",                     author: "Alisher Karimov",     country: "Kazakhstan", city: "Almaty",    ago: 1,  verified: 12 },
  { title: "QRight SDK — Reference Client",   kind: "code",   description: "TypeScript client library for the AEVION IP protection pipeline.",            author: "Maya Chen",           country: "Singapore",  city: "Singapore", ago: 3,  verified: 28 },
  { title: "Steppe Horizon — poster series",  kind: "design", description: "Eight-piece minimalist print series depicting Central Asian landscapes.",     author: "Dariga Mukhanova",    country: "Kazakhstan", city: "Astana",    ago: 5,  verified: 7  },
  { title: "On the Economics of Digital IP",  kind: "text",   description: "Long-form essay on cryptographic proof-of-existence vs. traditional patents.", author: "Prof. Jorge Mendes",  country: "Portugal",   city: "Lisbon",    ago: 8,  verified: 41 },
  { title: "Nebula — short film (12 min)",    kind: "video",  description: "Indie sci-fi short exploring memory and quantum mechanics.",                  author: "Ola Berg",            country: "Sweden",     city: "Stockholm", ago: 11, verified: 18 },
  { title: "Protocol idea: zk-rollup for IP", kind: "idea",   description: "Hypothesis for batching IP certificate issuance into a zk-rollup.",           author: "Rohan Patel",         country: "India",      city: "Bangalore", ago: 14, verified: 5  },
  { title: "Kaspi QR flow — UX kit",          kind: "design", description: "Figma kit of the Kaspi QR payment journey with edge cases.",                  author: "Saltanat Nurpeisova", country: "Kazakhstan", city: "Almaty",    ago: 19, verified: 9  },
  { title: "Merkle-tree attestation paper",   kind: "text",   description: "Short technical note: how Merkle inclusion proofs anchor our registry.",      author: "Dr. Felix Moreau",    country: "France",     city: "Paris",     ago: 25, verified: 33 },
];

function makeHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightObject" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "contentHash" TEXT NOT NULL,
      "ownerName" TEXT,
      "ownerEmail" TEXT,
      "ownerUserId" TEXT,
      "country" TEXT,
      "city" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShield" (
      "id" TEXT PRIMARY KEY,
      "objectId" TEXT,
      "objectTitle" TEXT,
      "algorithm" TEXT NOT NULL DEFAULT 'Shamir''s Secret Sharing + Ed25519',
      "threshold" INT NOT NULL DEFAULT 2,
      "totalShards" INT NOT NULL DEFAULT 3,
      "shards" TEXT NOT NULL,
      "signature" TEXT,
      "publicKey" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "IPCertificate" (
      "id" TEXT PRIMARY KEY,
      "objectId" TEXT NOT NULL,
      "shieldId" TEXT,
      "title" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "authorName" TEXT,
      "authorEmail" TEXT,
      "country" TEXT,
      "city" TEXT,
      "contentHash" TEXT NOT NULL,
      "signatureHmac" TEXT NOT NULL,
      "signatureEd25519" TEXT,
      "publicKeyEd25519" TEXT,
      "shardCount" INT DEFAULT 3,
      "shardThreshold" INT DEFAULT 2,
      "algorithm" TEXT NOT NULL,
      "legalBasis" JSONB NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "protectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "verifiedCount" INT NOT NULL DEFAULT 0,
      "lastVerifiedAt" TIMESTAMPTZ
    );
  `);
}

async function maybeReset(pool: Pool): Promise<void> {
  if (!process.argv.includes("--reset")) return;
  console.log("[seed] --reset: deleting existing rows in IPCertificate / QuantumShield / QRightObject");
  await pool.query(`DELETE FROM "IPCertificate"`);
  await pool.query(`DELETE FROM "QuantumShield"`);
  await pool.query(`DELETE FROM "QRightObject"`);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL is not set. The seed script writes to Postgres — set DATABASE_URL and try again.");
    console.error("       For in-memory demos no seed is needed; the backend ships with these 8 certs out of the box.");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureSchema(pool);
    await maybeReset(pool);

    let inserted = 0;
    for (const s of SEEDS) {
      const protectedAt = daysAgo(s.ago);
      const lastVerifiedAt = daysAgo(Math.max(0, s.ago - 1));
      const objectId = crypto.randomUUID();
      const raw = JSON.stringify({ title: s.title, description: s.description, kind: s.kind, country: s.country, city: s.city });
      const contentHash = makeHash(raw);
      const id = "cert-" + crypto.randomBytes(8).toString("hex");
      const shieldId = "qs-" + crypto.randomBytes(8).toString("hex");
      const sigHmac = makeHash(`${id}:${contentHash}:hmac`);
      const sigEd = makeHash(`${id}:ed25519`);
      const pubKey = makeHash(`${id}:pub`);
      const algorithm = "SHA-256 + HMAC-SHA256 + Ed25519 + Shamir's Secret Sharing";

      // QRight object — owner falls back to author since these are seeds.
      await pool.query(
        `INSERT INTO "QRightObject" ("id","title","description","kind","contentHash","ownerName","ownerEmail","ownerUserId","country","city","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,$7,$8,$9)
         ON CONFLICT ("id") DO NOTHING`,
        [objectId, s.title, s.description, s.kind, contentHash, s.author, s.country, s.city, protectedAt]
      );

      // Quantum shield — placeholder shard ids; deterministic enough for demos.
      const shards = Array.from({ length: 3 }, (_, i) => ({
        index: i + 1,
        id: crypto.randomBytes(16).toString("hex"),
        location: ["Author Vault", "AEVION Platform", "Witness Node"][i],
        status: "active",
      }));
      await pool.query(
        `INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10)
         ON CONFLICT ("id") DO NOTHING`,
        [shieldId, objectId, s.title, "Shamir's Secret Sharing + Ed25519", 2, 3, JSON.stringify(shards), sigEd, pubKey, protectedAt]
      );

      // IP certificate.
      const r = await pool.query(
        `INSERT INTO "IPCertificate" ("id","objectId","shieldId","title","kind","description","authorName","authorEmail","country","city","contentHash","signatureHmac","signatureEd25519","publicKeyEd25519","shardCount","shardThreshold","algorithm","legalBasis","status","protectedAt","verifiedCount","lastVerifiedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,$13,3,2,$14,$15,'active',$16,$17,$18)
         ON CONFLICT ("id") DO NOTHING`,
        [id, objectId, shieldId, s.title, s.kind, s.description, s.author, s.country, s.city, contentHash, sigHmac, sigEd, pubKey, algorithm, JSON.stringify(SEED_LEGAL_BASIS), protectedAt, s.verified, lastVerifiedAt]
      );
      if ((r.rowCount ?? 0) > 0) inserted++;
    }

    console.log(`[seed] done — inserted ${inserted} of ${SEEDS.length} demo certificates into Postgres.`);
    if (inserted < SEEDS.length) {
      console.log("[seed] some rows were skipped via ON CONFLICT — re-run with --reset to start fresh.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
