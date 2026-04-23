/**
 * In-memory fallback store for the IP pipeline.
 *
 * Used transparently when Postgres is not reachable (no DATABASE_URL, or the
 * connection throws). Keeps the Bureau / QRight / Verify flows functional for
 * local dev and first-time demos without any infrastructure dependencies.
 *
 * The real Postgres path always wins — this store is only a fallback.
 */

import crypto from "crypto";

export type MemCertificate = {
  id: string;
  objectId: string;
  shieldId: string | null;
  title: string;
  kind: string;
  description: string;
  authorName: string | null;
  authorEmail: string | null;
  country: string | null;
  city: string | null;
  contentHash: string;
  signatureHmac: string;
  signatureEd25519: string | null;
  publicKeyEd25519: string | null;
  shardCount: number;
  shardThreshold: number;
  algorithm: string;
  legalBasis: unknown;
  status: string;
  protectedAt: string;
  verifiedCount: number;
  lastVerifiedAt: string | null;
};

export type MemShield = {
  id: string;
  objectId: string;
  objectTitle: string;
  algorithm: string;
  threshold: number;
  totalShards: number;
  shards: string;
  signature: string;
  publicKey: string;
  status: string;
  createdAt: string;
};

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

function makeHash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function seedCertificates(): MemCertificate[] {
  const seeds: Array<Partial<MemCertificate> & { title: string; kind: string; description: string; author: string; country: string; city: string; ago: number; verified: number; }> = [
    { title: "Lullaby No. 7 in D Minor",       kind: "music",  description: "Original orchestral composition in 6/8 time, 4 minutes.",                    author: "Alisher Karimov",  country: "Kazakhstan",  city: "Almaty",   ago: 1,  verified: 12 },
    { title: "QRight SDK — Reference Client",   kind: "code",   description: "TypeScript client library for the AEVION IP protection pipeline.",           author: "Maya Chen",         country: "Singapore",    city: "Singapore",ago: 3,  verified: 28 },
    { title: "Steppe Horizon — poster series", kind: "design", description: "Eight-piece minimalist print series depicting Central Asian landscapes.",    author: "Dariga Mukhanova", country: "Kazakhstan",  city: "Astana",   ago: 5,  verified: 7  },
    { title: "On the Economics of Digital IP", kind: "text",   description: "Long-form essay on cryptographic proof-of-existence vs. traditional patents.", author: "Prof. Jorge Mendes",country: "Portugal",     city: "Lisbon",   ago: 8,  verified: 41 },
    { title: "Nebula — short film (12 min)",    kind: "video",  description: "Indie sci-fi short exploring memory and quantum mechanics.",                 author: "Ola Berg",          country: "Sweden",       city: "Stockholm",ago: 11, verified: 18 },
    { title: "Protocol idea: zk-rollup for IP",kind: "idea",   description: "Hypothesis for batching IP certificate issuance into a zk-rollup.",          author: "Rohan Patel",       country: "India",         city: "Bangalore",ago: 14, verified: 5  },
    { title: "Kaspi QR flow — UX kit",          kind: "design", description: "Figma kit of the Kaspi QR payment journey with edge cases.",                 author: "Saltanat Nurpeisova",country: "Kazakhstan", city: "Almaty",   ago: 19, verified: 9  },
    { title: "Merkle-tree attestation paper",   kind: "text",   description: "Short technical note: how Merkle inclusion proofs anchor our registry.",    author: "Dr. Felix Moreau",  country: "France",       city: "Paris",    ago: 25, verified: 33 },
  ];

  return seeds.map((s) => {
    const protectedAt = daysAgo(s.ago);
    const objectId = crypto.randomUUID();
    const raw = JSON.stringify({ title: s.title, description: s.description, kind: s.kind, country: s.country, city: s.city });
    const contentHash = makeHash(raw);
    const id = "cert-" + crypto.randomBytes(8).toString("hex");
    const shieldId = "qs-" + crypto.randomBytes(8).toString("hex");
    const sigHmac = makeHash(`${id}:${contentHash}:hmac`);
    return {
      id,
      objectId,
      shieldId,
      title: s.title,
      kind: s.kind,
      description: s.description,
      authorName: s.author,
      authorEmail: null,
      country: s.country,
      city: s.city,
      contentHash,
      signatureHmac: sigHmac,
      signatureEd25519: makeHash(`${id}:ed25519`),
      publicKeyEd25519: makeHash(`${id}:pub`),
      shardCount: 3,
      shardThreshold: 2,
      algorithm: "SHA-256 + HMAC-SHA256 + Ed25519 + Shamir's Secret Sharing",
      legalBasis: SEED_LEGAL_BASIS,
      status: "active",
      protectedAt,
      verifiedCount: s.verified,
      lastVerifiedAt: daysAgo(Math.max(0, s.ago - 1)),
    };
  });
}

const state = {
  certificates: seedCertificates(),
  shields: [] as MemShield[],
  seeded: true,
};

export function memoryEnabled() {
  return !process.env.DATABASE_URL || process.env.AEVION_FORCE_MEMORY_PIPELINE === "1";
}

export function memAddShield(shield: MemShield) { state.shields.push(shield); }

export function memAddCertificate(cert: MemCertificate) {
  state.certificates.unshift(cert);
}

export function memGetShield(id: string) {
  return state.shields.find((s) => s.id === id) || null;
}

export function memGetCertificate(id: string): MemCertificate | null {
  return state.certificates.find((c) => c.id === id) || null;
}

export function memIncrementVerify(id: string) {
  const c = state.certificates.find((x) => x.id === id);
  if (c) { c.verifiedCount++; c.lastVerifiedAt = new Date().toISOString(); }
  return c;
}

export function memListCertificates(opts: { q?: string; kind?: string; sort?: string; limit?: number }) {
  const { q = "", kind = "", sort = "recent" } = opts;
  const limit = Math.min(5000, Math.max(1, opts.limit ?? 60));
  const qLower = q.trim().toLowerCase();
  let list = state.certificates.filter((c) => c.status === "active");
  if (qLower) {
    list = list.filter((c) =>
      (c.title || "").toLowerCase().includes(qLower) ||
      (c.authorName || "").toLowerCase().includes(qLower) ||
      (c.country || "").toLowerCase().includes(qLower) ||
      (c.city || "").toLowerCase().includes(qLower)
    );
  }
  if (kind && ["music","code","design","text","video","idea","other"].includes(kind)) {
    list = list.filter((c) => c.kind === kind);
  }
  if (sort === "popular") {
    list = [...list].sort((a, b) => (b.verifiedCount - a.verifiedCount) || (a.protectedAt < b.protectedAt ? 1 : -1));
  } else if (sort === "az") {
    list = [...list].sort((a, b) => (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase()));
  } else {
    list = [...list].sort((a, b) => (a.protectedAt < b.protectedAt ? 1 : -1));
  }
  return list.slice(0, limit);
}

export function memStats() {
  const active = state.certificates.filter((c) => c.status === "active");
  const totalCerts = active.length;
  const totalVerifications = active.reduce((s, c) => s + c.verifiedCount, 0);
  const authorsApprox = new Set(active.map((c) => (c.authorName || "").toLowerCase())).size;
  const countriesApprox = new Set(active.map((c) => (c.country || "").toLowerCase())).size;
  const lastProtectedAt = active.map((c) => c.protectedAt).sort().pop() || null;

  const byKindMap = new Map<string, { count: number; verifications: number }>();
  for (const c of active) {
    const cur = byKindMap.get(c.kind) || { count: 0, verifications: 0 };
    cur.count++; cur.verifications += c.verifiedCount;
    byKindMap.set(c.kind, cur);
  }
  const byKind = Array.from(byKindMap, ([kind, v]) => ({ kind, count: v.count, verifications: v.verifications })).sort((a, b) => b.count - a.count);

  const byCountryMap = new Map<string, number>();
  for (const c of active) {
    const k = c.country || "Unknown";
    byCountryMap.set(k, (byCountryMap.get(k) || 0) + 1);
  }
  const byCountry = Array.from(byCountryMap, ([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const series: Array<{ day: string; count: number }> = [];
  const today = new Date();
  const counts = new Map<string, number>();
  for (const c of active) {
    const key = new Date(c.protectedAt).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, count: counts.get(key) ?? 0 });
  }

  const latest = [...active].sort((a, b) => (a.protectedAt < b.protectedAt ? 1 : -1)).slice(0, 5);

  return {
    totals: { certificates: totalCerts, verifications: totalVerifications, authorsApprox, countriesApprox, lastProtectedAt },
    byKind,
    byCountry,
    growth30d: series,
    latest,
  };
}
