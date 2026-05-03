import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type NotaryDetail = {
  id: string;
  fullName: string;
  licenseNumber: string;
  jurisdiction: string;
  city: string | null;
  publicKeyEd25519: string;
  publicKeyFingerprint: string;
  contractSignedAt: string | null;
  createdAt: string;
  active: boolean;
  deactivatedAt: string | null;
};

async function loadNotary(id: string): Promise<NotaryDetail | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/bureau/notaries/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as NotaryDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ notaryId: string }> }): Promise<Metadata> {
  const { notaryId } = await params;
  const n = await loadNotary(notaryId);
  return {
    title: n ? `${n.fullName} — AEVION Notary Registry` : "Notary — AEVION IP Bureau",
  };
}

export default async function NotaryDetailPage({ params }: { params: Promise<{ notaryId: string }> }) {
  const { notaryId } = await params;
  const n = await loadNotary(notaryId);

  if (!n) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="text-5xl">⚖️</div>
        <p>Notary not found.</p>
        <Link href="/bureau/notaries" className="text-teal-400 underline text-sm">← Notary Registry</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pt-20 pb-24 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-violet-900/40 border border-violet-700 flex items-center justify-center text-2xl">⚖️</div>
          <div>
            <h1 className="text-xl font-bold text-white">{n.fullName}</h1>
            <p className="text-slate-500 text-sm">{n.jurisdiction}{n.city ? `, ${n.city}` : ""}</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h2 className="font-semibold text-slate-200">Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500">License</dt>
            <dd className="font-mono text-slate-300 text-xs">{n.licenseNumber}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${n.active ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700" : "bg-red-900/50 text-red-400 border border-red-700"}`}>
                {n.active ? "Active" : "Inactive"}
              </span>
            </dd>
            {n.contractSignedAt && (
              <>
                <dt className="text-slate-500">Partner since</dt>
                <dd className="text-slate-300">{new Date(n.contractSignedAt).toLocaleDateString()}</dd>
              </>
            )}
            <dt className="text-slate-500">Key fingerprint</dt>
            <dd className="font-mono text-slate-400 text-xs break-all">{n.publicKeyFingerprint}</dd>
          </dl>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-3">
          <h2 className="font-semibold text-slate-200">Ed25519 Public Key</h2>
          <p className="text-xs text-slate-500">
            Use this key to verify notary signatures offline without contacting AEVION.
          </p>
          <pre className="bg-slate-950 rounded-lg p-4 text-xs font-mono text-teal-300 overflow-x-auto break-all whitespace-pre-wrap border border-slate-800">
{`-----BEGIN PUBLIC KEY-----
${n.publicKeyEd25519}
-----END PUBLIC KEY-----`}
          </pre>
          <button
            onClick={() => {
              if (typeof navigator !== "undefined") {
                navigator.clipboard.writeText(n.publicKeyEd25519).catch(() => {});
              }
            }}
            className="text-xs text-slate-400 hover:text-teal-300 transition-colors underline"
          >
            Copy key
          </button>
        </div>

        <Link href="/bureau/notaries" className="inline-block text-teal-400 underline text-sm">
          ← Notary Registry
        </Link>
      </div>
    </div>
  );
}
