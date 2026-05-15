import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notary Registry — AEVION IP Bureau",
  description: "Verified notarial partners who co-sign IP certificates with Ed25519 digital signatures.",
};

type Notary = {
  id: string;
  fullName: string;
  licenseNumber: string;
  jurisdiction: string;
  city: string | null;
  publicKeyFingerprint: string;
  contractSignedAt: string | null;
  createdAt: string;
};

async function loadNotaries(jurisdiction?: string): Promise<Notary[]> {
  try {
    const url = new URL(`${getApiBase()}/api/bureau/notaries`);
    if (jurisdiction) url.searchParams.set("jurisdiction", jurisdiction);
    const r = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { notaries?: Notary[] };
    return j.notaries ?? [];
  } catch {
    return [];
  }
}

const JURISDICTION_LABELS: Record<string, string> = {
  KZ: "Kazakhstan",
  EU: "European Union",
  US: "United States",
  RU: "Russia",
  UA: "Ukraine",
  GB: "United Kingdom",
};

function jLabel(j: string): string {
  return JURISDICTION_LABELS[j] || j;
}

type SearchParamsRaw = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParamsRaw> };

export default async function NotaryRegistryPage({ searchParams }: Props) {
  const sp: SearchParamsRaw = searchParams ? await searchParams : {};
  const jurisdiction = typeof sp.jurisdiction === "string" ? sp.jurisdiction : undefined;
  const notaries = await loadNotaries(jurisdiction);

  const jurisdictions = Array.from(new Set(notaries.map((n) => n.jurisdiction)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs text-teal-400 uppercase tracking-widest mb-3">AEVION IP Bureau</div>
          <h1 className="text-3xl font-bold text-white mb-3">Notary Registry</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            AEVION-vetted notarial partners who co-sign IP certificates with Ed25519 digital signatures.
            A Notarized badge means a licensed notary has independently verified the authorship claim.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">

        {/* Jurisdiction filter */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bureau/notaries"
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!jurisdiction ? "bg-teal-700 border-teal-600 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-teal-300"}`}
          >
            All
          </Link>
          {jurisdictions.map((j) => (
            <Link
              key={j}
              href={`/bureau/notaries?jurisdiction=${j}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${jurisdiction === j ? "bg-teal-700 border-teal-600 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-teal-300"}`}
            >
              {jLabel(j)}
            </Link>
          ))}
        </div>

        {/* Notary list */}
        {notaries.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-5xl mb-4">🏛️</div>
            <p className="text-lg font-medium text-slate-400">No notaries found</p>
            <p className="text-sm mt-2">
              {jurisdiction ? `No active notaries in ${jLabel(jurisdiction)}.` : "The notary registry is empty. Check back soon."}
            </p>
            <Link href="/bureau" className="mt-6 inline-block text-teal-400 underline text-sm">← Bureau</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {notaries.map((n) => (
              <div key={n.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-900/40 border border-violet-700 flex items-center justify-center text-xl shrink-0">
                  ⚖️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-100">{n.fullName}</h3>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-700">
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <div>License: <span className="font-mono text-slate-400">{n.licenseNumber}</span></div>
                    <div>
                      {jLabel(n.jurisdiction)}{n.city ? `, ${n.city}` : ""}
                      {n.contractSignedAt && (
                        <span className="ml-2 text-slate-600">· Partner since {new Date(n.contractSignedAt).getFullYear()}</span>
                      )}
                    </div>
                    <div className="font-mono text-slate-600 truncate">
                      Key fingerprint: {n.publicKeyFingerprint}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/bureau/notaries/${n.id}`}
                  className="shrink-0 text-xs text-teal-400 hover:text-teal-300 transition-colors border border-teal-800 hover:border-teal-600 rounded-lg px-3 py-1.5"
                >
                  View public key →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 text-sm text-slate-400 space-y-2">
          <h2 className="font-semibold text-slate-300">How Notarized tier works</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-500">
            <li>Your certificate must first reach <span className="text-teal-400 font-medium">Verified</span> tier (KYC + payment).</li>
            <li>Submit a notarization request, selecting a partner notary.</li>
            <li>The notary independently verifies your authorship claim and co-signs with Ed25519.</li>
            <li>Your certificate badge upgrades to <span className="text-violet-400 font-medium">Notarized</span> with a permanent registry reference.</li>
          </ol>
          <p className="text-xs text-slate-600 pt-2">
            Third parties can verify the notary signature offline using the notary&apos;s public Ed25519 key listed above.
          </p>
        </div>

        <div className="text-center">
          <Link href="/bureau" className="text-teal-400 underline text-sm">← Back to Bureau</Link>
        </div>
      </div>
    </div>
  );
}
